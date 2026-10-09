// React glue for services/planner.ts: feeds it the food log, goals, menus and
// saved foods, and logs suggestions.
import { useToast } from '@/components/ui/Toast';
import { addDays, weekOf } from '@/services/dates';
import { FastAccessItem, fastAccessService, useFastAccess } from '@/services/FastAccessService';
import { useGoals } from '@/services/goals';
import { currentMealLabel, useMealSlots, usePreferences } from '@/services/preferences';
import { MealType } from '@/services/meals';
import { menuDatabase, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { quickLogEntry } from '@/services/menuLogging';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import { DailyLog, mealOf, NewTrackedItem, nutritionTracker, TrackedItem, useDayLogs, useToday } from '@/services/NutritionTracker';
import {
  buildMenuPool, buildSavedPool, dayOf, DayPlan, familiarityMap, FoodOption, learnMealShares, LoggedDay, mealWindow,
  MealTarget, planMeals, planWeek, recommend, Suggestion, WeekPlan,
} from '@/services/planner';
import { useMemo } from 'react';

export function toLoggedDay(log: DailyLog): LoggedDay {
  const byMeal: LoggedDay['byMeal'] = {};
  for (const item of log.items) {
    const meal = mealOf(item);
    const entry = byMeal[meal] ?? { calories: 0, protein: 0, items: 0 };
    entry.items += 1;
    if (item.nutrition_status !== 'none') {
      entry.calories += item.calories;
      entry.protein += item.protein;
    }
    byMeal[meal] = entry;
  }
  return { date: log.date, calories: log.totals.calories, protein: log.totals.protein, items: log.items.length, byMeal };
}

function toMap(logs: DailyLog[]): Map<string, LoggedDay> {
  return new Map(logs.map(log => [log.date, toLoggedDay(log)]));
}

// The balanced plan for the week containing `date` (default: this week).
export function useWeekPlan(date?: string): WeekPlan {
  const today = useToday();
  const { goals, profile, planner } = useGoals();
  const logs = useDayLogs(weekOf(date ?? today));
  return planWeek({
    today,
    date,
    logs: toMap(logs),
    goals: { calories: goals.calories, protein: goals.protein },
    sex: profile?.gender,
    balance: planner.balanceWeek,
  });
}

// A day's calorie and protein targets after weekly balancing.
export function useDayTargets(date: string): DayPlan {
  const plan = useWeekPlan(date);
  return dayOf(plan, date)!;
}

const HISTORY_DAYS = 28;

// How this user usually splits a day across meals.
export function useMealShares(): Record<MealType, number> {
  const today = useToday();
  const { goals } = useGoals();
  const dates = useMemo(() => Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, -i - 1)), [today]);
  const logs = useDayLogs(dates);
  const signature = logs.map(log => `${log.date}:${log.items.length}:${log.totals.calories}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => learnMealShares(logs.map(toLoggedDay), goals.calories), [signature, goals.calories]);
}

export function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

// Calorie and protein targets for each meal of `date`.
export function useMealPlan(date: string): { day: DayPlan; meals: MealTarget[]; week: WeekPlan } {
  const today = useToday();
  const now = useClock();
  const week = useWeekPlan(date);
  const [log] = useDayLogs([date]);
  const learned = useMealShares();
  const { schedule } = usePreferences();
  const slots = useMealSlots(date);
  const day = dayOf(week, date)!;
  const meals = planMeals({
    day,
    log: toLoggedDay(log),
    nowMinutes: date === today ? nowMinutes(now) : null,
    slots,
    // Learned meal sizes describe a three-meal day; other schedules use their own.
    shares: schedule.kind === 'standard' ? learned : undefined,
  });
  return { day, meals, week };
}

// Menu dishes with known nutrition, rebuilt when newer menus arrive.
let menuPoolCache: { revision: number; pool: FoodOption[] } | null = null;
function menuPool(revision: number): FoodOption[] {
  if (menuPoolCache?.revision !== revision) {
    const restaurants = menuDatabase.listRestaurants().flatMap(summary => {
      const menu = menuDatabase.loadRestaurant(summary.id);
      return menu ? [{ menu, hours: summary.hours ?? menu.hours }] : [];
    });
    menuPoolCache = { revision, pool: buildMenuPool(restaurants) };
  }
  return menuPoolCache.pool;
}

export function useSuggestions(date: string, target: MealTarget | undefined, limit = 4): Suggestion[] {
  const today = useToday();
  const now = useClock();
  const revision = useMenuRevision();
  const { all } = useFastAccess();
  const { food, schedule } = usePreferences();
  const { profile } = useGoals();
  const minute = date === today ? nowMinutes(now) : null;
  // Re-plan each quarter hour, not every minute.
  const bucket = minute === null ? null : Math.floor(minute / 15) * 15;
  const savedSignature = all.map(item => `${item.id}:${item.useCount}`).join(',');
  return useMemo(() => {
    if (!target || target.state !== 'planned') return [];
    const menu = menuPool(revision);
    const pool = [...menu, ...buildSavedPool(all, menu)];
    // Almost nothing is open before dawn, so suhoor planned ahead is picked
    // up the evening before.
    const pickUpEarly = schedule.kind === 'ramadan' && target.meal === 'breakfast' && bucket === null;
    const results = recommend({
      pool,
      meal: target.meal,
      calories: target.calories,
      protein: target.protein,
      date: pickUpEarly ? addDays(date, -1) : date,
      window: pickUpEarly ? { from: 19 * 60, to: 24 * 60 } : mealWindow(target.window, bucket),
      familiar: familiarityMap(all),
      limit,
      prefs: food,
      classYear: profile?.classYear,
    });
    return pickUpEarly ? results.map(result => ({ ...result, tags: [...result.tags, 'pick-up-early' as const] })) : results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, target?.meal, target?.state, target?.calories, target?.protein, target?.window.start, target?.window.end, bucket, revision, savedSignature, limit, food, schedule.kind, profile?.classYear]);
}

function entryFor(part: FoodOption, saved: FastAccessItem[]): NewTrackedItem | null {
  if (part.savedId) {
    const item = saved.find(food => food.id === part.savedId);
    return item ? fastAccessService.toNewTrackedItem(item) : null;
  }
  const found = menuItemFor(part);
  return found ? quickLogEntry(found.menu, found.item) : null;
}

export function suggestionTitle(suggestion: Suggestion): string {
  return suggestion.parts.map(part => part.name).join(' + ');
}

// Logs every part of a suggestion, with one Undo for all of it.
export function useLogSuggestion() {
  const toast = useToast();
  const { all } = useFastAccess();
  return async (suggestion: Suggestion, date: string, meal: MealType) => {
    const entries = suggestion.parts.map(part => entryFor(part, all));
    if (entries.some(entry => !entry)) {
      toast.show({ message: "That item isn't on the menu anymore.", tone: 'error' });
      return;
    }
    const added: TrackedItem[] = [];
    for (const entry of entries) added.push(await nutritionTracker.addTrackedItem(entry!, { date, meal }));
    toast.show({
      message: `Added ${suggestionTitle(suggestion)} to ${currentMealLabel(meal, date)}`,
      action: { label: 'Undo', onPress: () => added.forEach(item => nutritionTracker.removeItem(item.id, date)) },
    });
  };
}

// The menu and dish behind a suggestion part, for opening the item sheet.
export function menuItemFor(part: FoodOption): { menu: RestaurantMenu; item: MenuItem } | null {
  const menu = part.restaurantId ? menuDatabase.loadRestaurant(part.restaurantId) : null;
  const item = menu?.sections.flatMap(section => section.items).find(dish => dish.id === part.itemId);
  return menu && item ? { menu, item } : null;
}

// Weekly meal planner. Pure functions (no React, no storage) so the same
// logic runs in the app and in scripts/verify-planner.ts.
//
// The idea: what matters is the week, not any single day. The weekly budget
// is 7 × the daily goal. Each day's target is what's left of the week spread
// evenly over the days that remain, kept within a safe band around the daily
// goal so one big day never turns into a day of starving (or the reverse).
// Within a day, the target is split across the meals not eaten yet, using the
// user's own habits once there's enough history, and every suggested food has
// known nutrition: a Duke NetNutrition label or a meal the user saved.
import { addDays, dateFromKey, weekOf } from './dates';
import type { MealType } from './meals';
import { canQuickLog, computeNutrition, defaultSelection } from './menuNutrition';
import type { MenuItem, RestaurantMenu, WeeklyHours } from './menuTypes';

// ---- tuning ----

export const PLANNER = {
  // A day's calorie target stays within this fraction of the daily goal.
  maxDecrease: 0.15,
  maxIncrease: 0.15,
  // Never plan a day below these, whatever the week looks like.
  minDayCalories: { male: 1500, female: 1200, unknown: 1200 },
  // Protein targets rise to catch up a short week, up to this multiple.
  maxProteinCatchUp: 1.3,
  // Deviations smaller than this aren't worth changing the target for.
  deadband: 40,
  // A logged day under this fraction of its target was probably only partly
  // logged, so it's treated as on target instead of as a surplus to eat back.
  incompleteFraction: 0.5,
  // Days of history needed before learned meal sizes outweigh the defaults.
  shareConfidenceDays: 4,
} as const;

export const DEFAULT_SHARES: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

// No meal is planned smaller than this (snacks are simply dropped instead),
// and no meal larger than this share of the day.
const MEAL_FLOOR: Record<MealType, number> = { breakfast: 250, lunch: 350, dinner: 400, snack: 150 };
const MEAL_CAP: Record<MealType, number> = { breakfast: 0.45, lunch: 0.45, dinner: 0.45, snack: 0.2 };
const MEAL_PROTEIN_CAP = 60;

// Minutes after midnight. A meal not logged by the end of its window is
// treated as skipped; suggestions need the restaurant open during it.
export const MEAL_WINDOWS: Record<MealType, { start: number; end: number }> = {
  breakfast: { start: 7 * 60, end: 11 * 60 + 30 },
  lunch: { start: 11 * 60, end: 16 * 60 },
  dinner: { start: 17 * 60, end: 22 * 60 },
  snack: { start: 14 * 60, end: 23 * 60 },
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---- inputs ----

export interface Totals {
  calories: number;
  protein: number;
}

export interface LoggedDay extends Totals {
  date: string;
  items: number;
  byMeal: Partial<Record<MealType, Totals & { items: number }>>;
}

export type Sex = 'male' | 'female' | null | undefined;

// ---- the week ----

export type DayPhase = 'past' | 'today' | 'future';
// logged: real numbers. assumed: nothing logged, so taken as on target.
// incomplete: too little logged to trust. projected: today/future, planned.
export type DayBasis = 'logged' | 'assumed' | 'incomplete' | 'projected';

export interface DayPlan {
  date: string;
  phase: DayPhase;
  goal: number; // the base daily calorie goal
  target: number; // this day's calorie target after balancing
  proteinTarget: number;
  adjustment: number; // target − goal
  limited: boolean; // the week wanted more change than the safe band allows
  eaten: Totals; // what's actually logged
  basis: DayBasis;
}

export interface WeekPlan {
  start: string;
  days: DayPlan[];
  weekly: Totals; // the week's budget
  eaten: Totals; // logged so far this week
  // Calories over (+) or under (−) the base goal on the days already counted
  // (past days, plus today once it's over its target).
  carry: number;
  proteinCarry: number; // protein short (−) or ahead (+) on past days
  // Where the week ends if the plan is followed, versus the budget.
  projectedDifference: number;
  remainingDays: number; // today and the days after it
  balanced: boolean;
}

function round10(value: number): number {
  return Math.round(value / 10) * 10;
}

export function dayBounds(goal: number, sex: Sex): { floor: number; ceiling: number } {
  const minimum = PLANNER.minDayCalories[sex ?? 'unknown'];
  const floor = Math.min(goal, Math.max(minimum, round10(goal * (1 - PLANNER.maxDecrease))));
  return { floor, ceiling: Math.max(goal, round10(goal * (1 + PLANNER.maxIncrease))) };
}

export function planWeek(input: {
  today: string;
  date?: string; // any day in the week to plan (defaults to today)
  logs: Map<string, LoggedDay>;
  goals: Totals;
  sex?: Sex;
  balance: boolean;
}): WeekPlan {
  const { today, logs, goals, sex, balance } = input;
  const week = weekOf(input.date ?? today);
  const G = goals.calories;
  const P = goals.protein;
  const { floor, ceiling } = dayBounds(G, sex);
  const proteinCeiling = Math.round(P * PLANNER.maxProteinCatchUp);

  let used = 0; // calories counted toward the week so far
  let usedProtein = 0;
  let carry = 0;
  let proteinCarry = 0;
  const eaten: Totals = { calories: 0, protein: 0 };
  const days: DayPlan[] = week.map((date, index) => {
    const remaining = 7 - index;
    const phase: DayPhase = date < today ? 'past' : date === today ? 'today' : 'future';
    const log = logs.get(date);
    const actual: Totals = { calories: log?.calories ?? 0, protein: log?.protein ?? 0 };
    if (phase !== 'future') {
      eaten.calories += actual.calories;
      eaten.protein += actual.protein;
    }

    let target = G;
    let proteinTarget = P;
    let limited = false;
    if (balance) {
      const raw = (7 * G - used) / remaining;
      const clamped = Math.min(ceiling, Math.max(floor, raw));
      limited = clamped !== raw;
      target = Math.abs(clamped - G) < PLANNER.deadband ? G : round10(clamped);
      const rawProtein = (7 * P - usedProtein) / remaining;
      proteinTarget = Math.round(Math.min(proteinCeiling, Math.max(P, rawProtein)));
    }

    // What this day counts as when planning the days after it.
    let basis: DayBasis;
    let counted: Totals;
    if (phase === 'past') {
      if (!log || log.items === 0) {
        basis = 'assumed';
        counted = { calories: target, protein: proteinTarget };
      } else if (actual.calories < target * PLANNER.incompleteFraction) {
        basis = 'incomplete';
        counted = { calories: target, protein: proteinTarget };
      } else {
        basis = 'logged';
        counted = actual;
      }
      carry += counted.calories - G;
      proteinCarry += counted.protein - P;
    } else if (phase === 'today') {
      // Today counts as at least its target: it isn't over yet.
      basis = 'projected';
      counted = { calories: Math.max(actual.calories, target), protein: Math.max(actual.protein, proteinTarget) };
      if (actual.calories > target) carry += actual.calories - G;
    } else {
      basis = 'projected';
      counted = { calories: target, protein: proteinTarget };
    }
    used += counted.calories;
    usedProtein += counted.protein;

    return { date, phase, goal: G, target, proteinTarget, adjustment: target - G, limited, eaten: actual, basis };
  });

  return {
    start: week[0],
    days,
    weekly: { calories: 7 * G, protein: 7 * P },
    eaten,
    carry: Math.round(carry),
    proteinCarry: Math.round(proteinCarry),
    projectedDifference: Math.round(used - 7 * G),
    remainingDays: days.filter(day => day.phase !== 'past').length,
    balanced: balance,
  };
}

export function dayOf(plan: WeekPlan, date: string): DayPlan | undefined {
  return plan.days.find(day => day.date === date);
}

// One calm sentence about where the week stands.
export function weekMessage(plan: WeekPlan): { tone: 'good' | 'info' | 'warning'; text: string } {
  const today = plan.days.find(day => day.phase === 'today');
  const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString();
  if (!plan.balanced) {
    return { tone: 'info', text: 'Weekly balancing is off. Every day uses your daily target.' };
  }
  if (Math.abs(plan.carry) < 150) {
    return { tone: 'good', text: 'Right on track for the week.' };
  }
  const rest = plan.remainingDays;
  const days = rest === 1 ? 'today' : `the next ${rest} days`;
  if (plan.carry > 0) {
    if (plan.projectedDifference > 150) {
      return {
        tone: 'warning',
        text: `${fmt(plan.carry)} cal over so far. ${rest === 1 ? 'Today is' : `${capitalize(days)} are`} as light as we'd safely plan, so the week may finish about ${fmt(plan.projectedDifference)} over. That's okay.`,
      };
    }
    return {
      tone: 'info',
      text: `${fmt(plan.carry)} cal over so far, so ${days} ${rest === 1 ? 'is' : 'are'} about ${fmt(today?.adjustment ?? 0)} lighter to balance it out.`,
    };
  }
  if (plan.projectedDifference < -150) {
    return { tone: 'info', text: `${fmt(plan.carry)} cal under so far. You have room for more, up to a comfortable limit each day.` };
  }
  return { tone: 'info', text: `${fmt(plan.carry)} cal under so far, so you have about ${fmt(today?.adjustment ?? 0)} more to eat each day.` };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---- meals within a day ----

// Learns how the user usually splits a day across meals, from days that
// look fully logged, blended with sensible defaults until there's history.
export function learnMealShares(days: LoggedDay[], goal: number): Record<MealType, number> {
  const usable = days.filter(day =>
    day.calories >= goal * PLANNER.incompleteFraction
    && MEAL_ORDER.filter(meal => (day.byMeal[meal]?.items ?? 0) > 0).length >= 2,
  );
  if (!usable.length) return { ...DEFAULT_SHARES };
  const sums: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const day of usable) {
    for (const meal of MEAL_ORDER) sums[meal] += (day.byMeal[meal]?.calories ?? 0) / day.calories;
  }
  const weight = usable.length / (usable.length + PLANNER.shareConfidenceDays);
  const shares = {} as Record<MealType, number>;
  let total = 0;
  for (const meal of MEAL_ORDER) {
    // Keep every meal possible, even one the user usually skips.
    shares[meal] = Math.max(0.05, weight * (sums[meal] / usable.length) + (1 - weight) * DEFAULT_SHARES[meal]);
    total += shares[meal];
  }
  for (const meal of MEAL_ORDER) shares[meal] /= total;
  return shares;
}

export type MealState = 'eaten' | 'planned' | 'skipped' | 'optional';

export interface MealTarget {
  meal: MealType;
  state: MealState; // optional: a snack there's no room for today
  calories: number; // planned calories (or eaten, for eaten meals)
  protein: number;
  eaten: Totals;
  size: 'lighter' | 'usual' | 'bigger';
}

export function planMeals(input: {
  day: DayPlan;
  log?: LoggedDay;
  nowMinutes: number | null; // minutes after midnight for today; null for future days
  shares: Record<MealType, number>;
}): MealTarget[] {
  const { day, log, nowMinutes, shares } = input;
  const eatenTotal = log?.calories ?? 0;
  const eatenProtein = log?.protein ?? 0;
  const results = new Map<MealType, MealTarget>();
  const open: MealType[] = [];
  for (const meal of MEAL_ORDER) {
    const logged = log?.byMeal[meal];
    const eaten = { calories: logged?.calories ?? 0, protein: logged?.protein ?? 0 };
    if ((logged?.items ?? 0) > 0) {
      results.set(meal, { meal, state: 'eaten', calories: eaten.calories, protein: eaten.protein, eaten, size: 'usual' });
    } else if (nowMinutes !== null && nowMinutes >= MEAL_WINDOWS[meal].end) {
      results.set(meal, { meal, state: 'skipped', calories: 0, protein: 0, eaten, size: 'usual' });
    } else {
      open.push(meal);
    }
  }

  const allocation = allocate(Math.max(0, day.target - eatenTotal), open, shares, day.target);
  const plannedCalories = open.reduce((sum, meal) => sum + allocation[meal], 0);
  const proteinLeft = Math.max(0, day.proteinTarget - eatenProtein);
  for (const meal of open) {
    const calories = allocation[meal];
    const protein = plannedCalories > 0 ? Math.min(MEAL_PROTEIN_CAP, Math.round((proteinLeft * calories) / plannedCalories)) : 0;
    const usual = shares[meal] * day.goal;
    results.set(meal, {
      meal,
      state: calories > 0 ? 'planned' : 'optional',
      calories,
      protein,
      eaten: { calories: 0, protein: 0 },
      size: calories < usual * 0.85 ? 'lighter' : calories > usual * 1.15 ? 'bigger' : 'usual',
    });
  }
  return MEAL_ORDER.map(meal => results.get(meal)!);
}

// Splits `remaining` calories across open meals by share, then enforces each
// meal's floor and cap, re-splitting what's left until nothing is violated.
function allocate(remaining: number, open: MealType[], shares: Record<MealType, number>, dayTarget: number): Record<MealType, number> {
  const result: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  let active = [...open];
  let budget = remaining;
  for (let guard = 0; guard < 10 && active.length; guard++) {
    const shareTotal = active.reduce((sum, meal) => sum + shares[meal], 0);
    const value = (meal: MealType) => (budget * shares[meal]) / shareTotal;
    // A snack that won't fit is dropped first, and its share goes to the meals.
    if (active.includes('snack') && active.length > 1 && value('snack') < MEAL_FLOOR.snack) {
      active = active.filter(meal => meal !== 'snack');
      continue;
    }
    const fixed: MealType[] = [];
    for (const meal of active) {
      const cap = Math.max(MEAL_FLOOR[meal], dayTarget * MEAL_CAP[meal]);
      if (value(meal) < MEAL_FLOOR[meal]) {
        // Main meals keep a sensible minimum, even on a day that's already over.
        result[meal] = meal === 'snack' ? 0 : MEAL_FLOOR[meal];
        fixed.push(meal);
      } else if (value(meal) > cap) {
        result[meal] = cap;
        fixed.push(meal);
      }
    }
    if (!fixed.length) {
      for (const meal of active) result[meal] = value(meal);
      break;
    }
    for (const meal of fixed) budget -= result[meal];
    budget = Math.max(0, budget);
    active = active.filter(meal => !fixed.includes(meal));
  }
  for (const meal of MEAL_ORDER) result[meal] = round10(result[meal]);
  return result;
}

// ---- foods we can recommend ----

export type FoodCategory = 'main' | 'breakfast' | 'side' | 'drink' | 'dessert' | 'smoothie';

export interface FoodOption {
  key: string;
  name: string;
  source: 'menu' | 'saved';
  restaurantId: string | null;
  restaurantName: string;
  section: string;
  category: FoodCategory;
  calories: number;
  protein: number;
  approx: boolean; // estimated from several labels
  weekday: number | null; // only served this day (0 = Sunday)
  hours?: WeeklyHours;
  hoursKnown: boolean;
  itemId?: string; // menu item
  savedId?: string; // saved food
  details?: string;
}

// The user's saved foods (recents and their own meals), as stored by FastAccessService.
export interface SavedFood {
  id: string;
  name: string;
  restaurant: string;
  calories: number;
  protein: number;
  type: 'custom' | 'restaurant';
  useCount: number;
  details?: string;
  nutrition_status?: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parts of a dish rather than a dish: never recommended on their own.
const COMPONENT = /condiment|topping|dressing|sauce|salsa|spread|oils|add.?ins?\b|extras?\b|tortilla|crouton|leafy greens|protein\b|proteins\b|cheese\b|choose one|bread counter|breads and wraps|^bread$/i;
const DRINK = /coffee|espresso|beverage|drink|\btea\b|latte|refreshment|kettle|frapp|juice|iced|lassi|frozen/i;
const DESSERT_SECTION = /dessert|sweet|treat|gelato|soft serve|dole whip/i;
const DESSERT_NAME = /cookie|brownie|cupcake|cheesecake|donut|doughnut/i;
const SMOOTHIE_SECTION = /smoothie|acai|yogurt/i;
const SMOOTHIE_NAME = /smoothie|acai/i;
const BREAKFAST = /breakfast|brunch|bagel|biscuit|pancake|waffle|mcmuffin|mcgriddle|omelet|\beggs?\b|crepe|cereal|morning|pastr|muffin|croissant|french toast/i;
const MAIN = /salad|bowl|plate|entr[eé]e|sandwich|wrap|burger|pizza|pasta|meal|combo|taco|burrito|sushi|poke|ramen|handheld|grill|chicken|fish|curry/i;
const SIDE = /side|fries|small bites|appetizer|starter|snack|fruit|chips|soup/i;

// Not on the main campus; only suggested to people who've eaten there.
const REMOTE_RESTAURANTS = new Set(['duke-marine-lab']);

export function categorize(section: string, name: string): FoodCategory | 'component' {
  if (COMPONENT.test(section)) return 'component';
  if (SMOOTHIE_SECTION.test(section) || SMOOTHIE_NAME.test(name)) return 'smoothie';
  if (DRINK.test(section)) return 'drink';
  if (DESSERT_SECTION.test(section) || DESSERT_NAME.test(name)) return 'dessert';
  if (BREAKFAST.test(section) || BREAKFAST.test(name)) return 'breakfast';
  if (MAIN.test(section)) return 'main';
  if (SIDE.test(section)) return 'side';
  return 'main';
}

function sectionWeekday(section: string): number | null {
  const lower = section.toLowerCase();
  const index = WEEKDAYS.findIndex(day => lower.startsWith(day));
  return index >= 0 ? index : null;
}

function familiarKey(restaurant: string, name: string): string {
  return `${restaurant.toLowerCase()}|${name.toLowerCase()}`;
}

// Every dish whose default order has fully known nutrition: a label for each
// part (estimates from several labels allowed, partial ones not).
export function buildMenuPool(restaurants: { menu: RestaurantMenu; hours?: WeeklyHours }[]): FoodOption[] {
  const pool: FoodOption[] = [];
  for (const { menu, hours } of restaurants) {
    for (const section of menu.sections) {
      for (const item of section.items) {
        const option = menuOption(menu, section.name, item, hours);
        if (option) pool.push(option);
      }
    }
  }
  return pool;
}

function menuOption(menu: RestaurantMenu, section: string, item: MenuItem, hours?: WeeklyHours): FoodOption | null {
  const category = categorize(section, item.name);
  if (category === 'component') return null;
  if (!canQuickLog(menu, item)) return null;
  const result = computeNutrition(menu, item, defaultSelection(item));
  if (!result.totals || result.status !== 'complete') return null;
  if (result.totals.calories < 30) return null; // water, black coffee, a pickle
  return {
    key: `${menu.id}/${item.id}`,
    name: item.name,
    source: 'menu',
    restaurantId: menu.id,
    restaurantName: menu.name,
    section,
    category,
    calories: result.totals.calories,
    protein: result.totals.protein,
    approx: result.estimated,
    weekday: sectionWeekday(section),
    hours,
    hoursKnown: Boolean(hours && Object.keys(hours).length),
    itemId: item.id,
  };
}

// The user's own meals, and recent orders that differ from a menu's default
// (so the exact order they like can be suggested again).
export function buildSavedPool(saved: SavedFood[], menuPool: FoodOption[]): FoodOption[] {
  const hoursByRestaurant = new Map<string, { id: string | null; hours?: WeeklyHours; known: boolean }>();
  for (const option of menuPool) {
    if (!hoursByRestaurant.has(option.restaurantName)) {
      hoursByRestaurant.set(option.restaurantName, { id: option.restaurantId, hours: option.hours, known: option.hoursKnown });
    }
  }
  const menuKeys = new Set(menuPool.map(option => familiarKey(option.restaurantName, option.name)));
  const pool: FoodOption[] = [];
  for (const food of saved) {
    if (food.nutrition_status === 'none' || food.nutrition_status === 'partial') continue;
    if (!(food.calories >= 30)) continue;
    if (food.type === 'restaurant') {
      // A plain recent order is already in the menu pool with fresh data.
      if (!food.details && menuKeys.has(familiarKey(food.restaurant, food.name))) continue;
      const place = hoursByRestaurant.get(food.restaurant);
      if (!place) continue; // restaurant no longer listed
      pool.push({
        key: `saved/${food.id}`,
        name: food.name,
        source: 'saved',
        restaurantId: place.id,
        restaurantName: food.restaurant,
        section: '',
        category: food.calories >= 300 ? 'main' : 'side',
        calories: food.calories,
        protein: food.protein,
        approx: food.nutrition_status === 'estimated',
        weekday: null,
        hours: place.hours,
        hoursKnown: place.known,
        savedId: food.id,
        details: food.details,
      });
    } else {
      pool.push({
        key: `saved/${food.id}`,
        name: food.name,
        source: 'saved',
        restaurantId: null,
        restaurantName: 'My meal',
        section: '',
        category: food.calories >= 300 ? 'main' : 'side',
        calories: food.calories,
        protein: food.protein,
        approx: false,
        weekday: null,
        hoursKnown: true,
        savedId: food.id,
      });
    }
  }
  return pool;
}

function minutesOf(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

// Whether a place with these hours is open for at least `need` minutes
// between `from` and `to` (minutes after midnight) on `weekday`.
export function openDuring(hours: WeeklyHours | undefined, weekday: number, from: number, to: number, need = 30): boolean {
  if (!hours) return false;
  const intervals = hours[DAY_NAMES[weekday]] ?? [];
  return intervals.some(([open, close]) => {
    const start = Math.max(from, minutesOf(open));
    const end = Math.min(to, close === '23:59' ? 24 * 60 : minutesOf(close));
    return end - start >= Math.min(need, to - from);
  });
}

export interface Suggestion {
  key: string;
  parts: FoodOption[];
  calories: number;
  protein: number;
  approx: boolean;
  tags: ('high-protein' | 'favorite' | 'my-meal' | 'check-hours')[];
  score: number;
}

// How each kind of food suits each meal: a penalty (lower is better), or
// null when it shouldn't be suggested as that meal on its own.
const MEAL_FIT: Record<MealType, Partial<Record<FoodCategory, number>>> = {
  breakfast: { breakfast: 0, smoothie: 0.05, main: 0.12 },
  lunch: { main: 0, breakfast: 0.25, smoothie: 0.2 },
  dinner: { main: 0, breakfast: 0.3, smoothie: 0.25 },
  snack: { side: 0, smoothie: 0, drink: 0.05, breakfast: 0.05, dessert: 0.12, main: 0.08 },
};
const PARTNERS = new Set<FoodCategory>(['side', 'drink', 'smoothie']);

export function recommend(input: {
  pool: FoodOption[];
  meal: MealType;
  calories: number;
  protein: number;
  date: string;
  window: { from: number; to: number }; // minutes after midnight
  familiar: Map<string, number>; // familiarKey → times logged
  limit?: number;
}): Suggestion[] {
  const { pool, meal, calories: C, protein: P, date, window, familiar } = input;
  const limit = input.limit ?? 4;
  if (C < 120) return [];
  const weekday = dateFromKey(date).getDay();
  const fit = MEAL_FIT[meal];

  const available = pool.filter(option => {
    if (option.weekday !== null && option.weekday !== weekday) return false;
    if (option.restaurantId && REMOTE_RESTAURANTS.has(option.restaurantId)
      && !familiar.has(familiarKey(option.restaurantName, option.name))) return false;
    if (option.source === 'saved' && !option.restaurantId) return true;
    if (!option.hoursKnown) return true; // dining halls without published hours
    return openDuring(option.hours, weekday, window.from, window.to);
  });

  const preference = (option: FoodOption): number => {
    let penalty = 0;
    const times = familiar.get(familiarKey(option.restaurantName, option.name)) ?? 0;
    if (option.source === 'saved' && !option.restaurantId) penalty -= 0.1;
    else if (times > 0) penalty -= Math.min(0.12, 0.05 + 0.02 * Math.log2(times));
    if (!option.hoursKnown && option.source === 'menu') penalty += 0.04;
    if (option.approx) penalty += 0.03;
    return penalty;
  };

  const score = (calories: number, protein: number): number => {
    const error = (calories - C) / C;
    let s = error > 0 ? error * 2.2 : -error;
    if (P >= 5) s += (Math.max(0, P - protein) / P) * 1.1;
    return s;
  };

  const candidates: Suggestion[] = [];
  const singleRange = meal === 'snack' ? [0.4, 1.2] : [0.6, 1.15];

  // Single dishes.
  for (const option of available) {
    const mealFit = fit[option.category];
    if (mealFit === undefined) continue;
    if (option.calories < C * singleRange[0] || option.calories > C * singleRange[1]) continue;
    candidates.push(suggestion([option], score(option.calories, option.protein) + mealFit + preference(option)));
  }

  // A dish plus a side, drink or one of the user's meals, for bigger meals
  // where no single dish lands close.
  if (meal !== 'snack' && C >= 400) {
    // The anchor of a pair is a real dish, never a drink or another smoothie.
    const mains = available.filter(option => (option.category === 'main' || option.category === 'breakfast')
      && fit[option.category] !== undefined
      && option.calories >= C * 0.4 && option.calories <= C * 0.85);
    const partners = available.filter(option => PARTNERS.has(option.category) || (option.source === 'saved' && !option.restaurantId))
      .filter(option => option.calories <= C * 0.6);
    const byRestaurant = new Map<string, FoodOption[]>();
    for (const partner of partners) {
      const key = partner.restaurantId ?? '*';
      byRestaurant.set(key, [...(byRestaurant.get(key) ?? []), partner]);
    }
    const density = (option: FoodOption) => option.protein / Math.max(option.calories, 1);
    const topMains = [...mains].sort((a, b) => density(b) - density(a)).slice(0, 60);
    for (const main of topMains) {
      const options = [...(byRestaurant.get(main.restaurantId ?? '') ?? []), ...(byRestaurant.get('*') ?? [])];
      for (const partner of options) {
        if (partner.key === main.key) continue;
        const calories = main.calories + partner.calories;
        if (calories < C * 0.75 || calories > C * 1.12) continue;
        const protein = main.protein + partner.protein;
        candidates.push(suggestion(
          [main, partner],
          score(calories, protein) + (fit[main.category] ?? 0) + preference(main) + preference(partner) / 2 + 0.07,
        ));
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  // Varied picks: no repeated dish, one per restaurant first, then fill.
  const picked: Suggestion[] = [];
  const usedNames = new Set<string>();
  const usedPlaces = new Map<string, number>();
  for (const maxPerPlace of [1, 2]) {
    for (const candidate of candidates) {
      if (picked.length >= limit) break;
      if (picked.includes(candidate)) continue;
      if (candidate.parts.some(part => usedNames.has(part.name.toLowerCase()))) continue;
      const place = candidate.parts[0].restaurantId ?? 'mine';
      if ((usedPlaces.get(place) ?? 0) >= maxPerPlace) continue;
      picked.push(candidate);
      candidate.parts.forEach(part => usedNames.add(part.name.toLowerCase()));
      usedPlaces.set(place, (usedPlaces.get(place) ?? 0) + 1);
    }
  }

  for (const item of picked) {
    if (item.protein >= 20 && (item.protein * 4) / Math.max(item.calories, 1) >= 0.3) item.tags.push('high-protein');
    if (item.parts.some(part => part.source === 'saved' && !part.restaurantId)) item.tags.push('my-meal');
    else if (item.parts.some(part => familiar.has(familiarKey(part.restaurantName, part.name)))) item.tags.push('favorite');
    if (item.parts.some(part => part.source === 'menu' && !part.hoursKnown)) item.tags.push('check-hours');
  }
  return picked;
}

function suggestion(parts: FoodOption[], score: number): Suggestion {
  return {
    key: parts.map(part => part.key).join('+'),
    parts,
    calories: parts.reduce((sum, part) => sum + part.calories, 0),
    protein: Math.round(parts.reduce((sum, part) => sum + part.protein, 0) * 10) / 10,
    approx: parts.some(part => part.approx),
    tags: [],
    score,
  };
}

// When to look for open restaurants for a meal: the rest of its window today
// (from now), or the whole window on another day.
export function mealWindow(meal: MealType, nowMinutes: number | null): { from: number; to: number } {
  const window = MEAL_WINDOWS[meal];
  if (nowMinutes === null) return { from: window.start, to: window.end };
  const from = Math.max(window.start, nowMinutes);
  return { from, to: Math.max(from + 60, window.end) };
}

export function familiarityMap(saved: SavedFood[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const food of saved) {
    if (food.type === 'restaurant') map.set(familiarKey(food.restaurant, food.name), food.useCount);
  }
  return map;
}

// The days of the plan's horizon: today and the rest of the week (or
// tomorrow too, when today is the last day of the week).
export function planHorizon(today: string): string[] {
  const week = weekOf(today);
  const rest = week.filter(day => day >= today);
  return rest.length > 1 ? rest : [today, addDays(today, 1)];
}

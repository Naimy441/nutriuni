// Food log store. Each day is saved under `nutrition_log_YYYY-MM-DD` (the
// format earlier versions used, so existing history keeps working). Screens
// subscribe through hooks and update the moment anything is logged anywhere.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { dateFromKey, dayKey } from './dates';
import { fastAccessService } from './FastAccessService';
import { isMealType, mealForTime, MealType } from './meals';

export interface DailyNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// How much to trust a logged item's numbers. Items logged before this field
// existed came from NetNutrition labels directly.
export type TrackedNutritionStatus =
  | 'complete' // every part has a NetNutrition label
  | 'estimated' // built from components, or with options the labels can't reflect
  | 'partial' // some chosen options had no label and are not counted
  | 'manual' // entered by the user
  | 'none'; // logged without nutrition

export interface TrackedItem extends DailyNutrition {
  id: string;
  name: string;
  restaurant: string;
  serving_size: string;
  timestamp: number;
  details?: string; // chosen options, e.g. "Fries, Ranch"
  nutrition_status?: TrackedNutritionStatus;
  meal?: MealType;
}

export type NewTrackedItem = Omit<TrackedItem, 'id' | 'timestamp' | 'meal'>;

export interface DailyLog {
  date: string; // YYYY-MM-DD, local time
  items: TrackedItem[];
  totals: DailyNutrition;
}

const KEY_PREFIX = 'nutrition_log_';
const NUTRIENT_KEYS: (keyof DailyNutrition)[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

export function emptyTotals(): DailyNutrition {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
}

export function emptyLog(date: string): DailyLog {
  return { date, items: [], totals: emptyTotals() };
}

export function totalsOf(items: TrackedItem[]): DailyNutrition {
  const totals = emptyTotals();
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) totals[key] += Number(item[key]) || 0;
  }
  for (const key of NUTRIENT_KEYS) totals[key] = Math.round(totals[key] * 10) / 10;
  return totals;
}

export function mealOf(item: TrackedItem): MealType {
  return isMealType(item.meal) ? item.meal : mealForTime(new Date(item.timestamp));
}

// "640 cal", "~870 cal" for estimates, or "No nutrition" for items logged without it.
export function formatTrackedCalories(item: Pick<TrackedItem, 'calories' | 'nutrition_status'>): string {
  if (item.nutrition_status === 'none') return 'No nutrition';
  const approximate = item.nutrition_status === 'estimated' || item.nutrition_status === 'partial';
  return `${approximate ? '~' : ''}${Math.round(item.calories).toLocaleString()} cal`;
}

function normalize(date: string, raw: Partial<DailyLog> | null): DailyLog {
  const items = (raw?.items ?? []).map(item => ({ ...item, sodium: Number(item.sodium) || 0 }));
  return { date, items, totals: totalsOf(items) };
}

class NutritionTrackerService {
  private static instance: NutritionTrackerService;
  private days = new Map<string, DailyLog>();
  private pending = new Map<string, Promise<DailyLog>>();
  private loggedDays: string[] | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;

  static getInstance(): NutritionTrackerService {
    if (!NutritionTrackerService.instance) {
      NutritionTrackerService.instance = new NutritionTrackerService();
    }
    return NutritionTrackerService.instance;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getRevision = () => this.revision;

  private emit() {
    this.revision++;
    this.listeners.forEach(listener => listener());
  }

  // Cached copy, or undefined until loadDay() has finished for that date.
  peekDay(date: string): DailyLog | undefined {
    return this.days.get(date);
  }

  peekLoggedDays(): string[] | null {
    return this.loggedDays;
  }

  loadDay(date: string): Promise<DailyLog> {
    const cached = this.days.get(date);
    if (cached) return Promise.resolve(cached);
    let pending = this.pending.get(date);
    if (!pending) {
      pending = AsyncStorage.getItem(KEY_PREFIX + date)
        .then(text => normalize(date, text ? JSON.parse(text) : null))
        .catch(() => emptyLog(date))
        .then(log => {
          this.days.set(date, log);
          this.pending.delete(date);
          this.emit();
          return log;
        });
      this.pending.set(date, pending);
    }
    return pending;
  }

  private async save(log: DailyLog) {
    const next = { ...log, totals: totalsOf(log.items) };
    this.days.set(log.date, next);
    if (this.loggedDays) {
      const others = this.loggedDays.filter(day => day !== log.date);
      this.loggedDays = next.items.length ? [...others, log.date].sort() : others;
    }
    this.emit();
    if (next.items.length) {
      await AsyncStorage.setItem(KEY_PREFIX + log.date, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(KEY_PREFIX + log.date);
    }
  }

  async addTrackedItem(entry: NewTrackedItem, options: { date?: string; meal?: MealType } = {}): Promise<TrackedItem> {
    const now = new Date();
    const date = options.date ?? dayKey(now);
    // Logging to another day keeps today's clock time on that date.
    const at = dateFromKey(date);
    at.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    const item: TrackedItem = {
      ...entry,
      sodium: entry.sodium ?? 0,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: at.getTime(),
      meal: options.meal ?? mealForTime(now),
    };
    const log = await this.loadDay(date);
    await this.save({ ...log, items: [...log.items, item] });
    await fastAccessService.addOrUpdateFastAccessItem(item);
    return item;
  }

  async removeItem(itemId: string, date: string = dayKey()): Promise<TrackedItem | undefined> {
    const log = await this.loadDay(date);
    const removed = log.items.find(item => item.id === itemId);
    if (removed) await this.save({ ...log, items: log.items.filter(item => item.id !== itemId) });
    return removed;
  }

  // Puts an item back exactly as it was (undo).
  async restoreItem(item: TrackedItem, date: string): Promise<void> {
    const log = await this.loadDay(date);
    if (log.items.some(existing => existing.id === item.id)) return;
    const items = [...log.items, item].sort((a, b) => a.timestamp - b.timestamp);
    await this.save({ ...log, items });
  }

  async updateItem(itemId: string, date: string, patch: Partial<Omit<TrackedItem, 'id'>>): Promise<void> {
    const log = await this.loadDay(date);
    await this.save({ ...log, items: log.items.map(item => (item.id === itemId ? { ...item, ...patch } : item)) });
  }

  async clearDay(date: string): Promise<void> {
    await this.save(emptyLog(date));
  }

  // Every day with at least one logged item, oldest first.
  async listLoggedDays(): Promise<string[]> {
    if (this.loggedDays) return this.loggedDays;
    const keys = await AsyncStorage.getAllKeys();
    const days = keys.filter(key => key.startsWith(KEY_PREFIX)).map(key => key.slice(KEY_PREFIX.length)).sort();
    const entries = await AsyncStorage.multiGet(days.map(day => KEY_PREFIX + day));
    for (const [key, text] of entries) {
      const date = key.slice(KEY_PREFIX.length);
      if (this.days.has(date)) continue;
      try {
        this.days.set(date, normalize(date, text ? JSON.parse(text) : null));
      } catch {
        this.days.set(date, emptyLog(date));
      }
    }
    this.loggedDays = days.filter(day => (this.days.get(day)?.items.length ?? 0) > 0);
    this.emit();
    return this.loggedDays;
  }
}

export const nutritionTracker = NutritionTrackerService.getInstance();

// ---- hooks ----

function useTrackerRevision() {
  return useSyncExternalStore(nutritionTracker.subscribe, nutritionTracker.getRevision);
}

export function useDayLog(date: string): { log: DailyLog; isLoading: boolean } {
  useTrackerRevision();
  useEffect(() => {
    nutritionTracker.loadDay(date);
  }, [date]);
  const log = nutritionTracker.peekDay(date);
  return { log: log ?? emptyLog(date), isLoading: !log };
}

export function useDayLogs(dates: string[]): DailyLog[] {
  useTrackerRevision();
  const signature = dates.join(',');
  useEffect(() => {
    signature.split(',').filter(Boolean).forEach(date => nutritionTracker.loadDay(date));
  }, [signature]);
  return dates.map(date => nutritionTracker.peekDay(date) ?? emptyLog(date));
}

// Days with logged food, oldest first ([] until loaded).
export function useLoggedDays(): string[] {
  useTrackerRevision();
  useEffect(() => {
    nutritionTracker.listLoggedDays();
  }, []);
  return nutritionTracker.peekLoggedDays() ?? [];
}

// The current local date; changes at midnight and when the app returns to
// the foreground on a new day.
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        setToday(dayKey());
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };
    schedule();
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') setToday(dayKey());
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return today;
}

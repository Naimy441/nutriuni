// The user's food preferences (diet, halal, allergies) and eating schedule.
// Stored under `preferences`; everything is optional and off by default.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { dayKey } from './dates';
import { Allergen, Diet, FoodPreferences, NO_PREFERENCES } from './dietary';
import { MealType } from './meals';
import { DEFAULT_SCHEDULE, EatingSchedule, MealSlot, mealAt, mealInfo, mealSlots } from './schedule';

const KEY = 'preferences';

export interface Preferences {
  food: FoodPreferences;
  schedule: EatingSchedule;
}

const DEFAULTS: Preferences = { food: NO_PREFERENCES, schedule: DEFAULT_SCHEDULE };
const DIETS: Diet[] = ['none', 'vegetarian', 'vegan'];

function sanitize(raw: Partial<Preferences> | null): Preferences {
  const food = raw?.food;
  const schedule = raw?.schedule;
  return {
    food: {
      diet: DIETS.includes(food?.diet as Diet) ? (food!.diet as Diet) : 'none',
      halal: Boolean(food?.halal),
      avoid: Array.isArray(food?.avoid) ? (food!.avoid.filter(code => typeof code === 'string') as Allergen[]) : [],
    },
    schedule: {
      kind: schedule?.kind ?? DEFAULT_SCHEDULE.kind,
      window: schedule?.window && schedule.window.end > schedule.window.start ? schedule.window : DEFAULT_SCHEDULE.window,
    },
  };
}

class PreferencesStore {
  private state: Preferences = DEFAULTS;
  private loading: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = () => this.state;

  private set(next: Preferences) {
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = AsyncStorage.getItem(KEY)
        .then(text => this.set(sanitize(text ? JSON.parse(text) : null)))
        .catch(() => {});
    }
    return this.loading;
  }

  async update(patch: { food?: Partial<FoodPreferences>; schedule?: Partial<EatingSchedule> }) {
    const next = sanitize({
      food: { ...this.state.food, ...patch.food },
      schedule: { ...this.state.schedule, ...patch.schedule },
    });
    this.set(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  async reset() {
    this.set(DEFAULTS);
    await AsyncStorage.removeItem(KEY);
  }
}

export const preferencesStore = new PreferencesStore();

export function usePreferences(): Preferences {
  return useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get);
}

// The meals of `date` under the user's schedule.
export function useMealSlots(date: string = dayKey()): MealSlot[] {
  const { schedule } = usePreferences();
  return useMemo(() => mealSlots(schedule, date), [schedule, date]);
}

export function useMealLabel(date?: string): (meal: MealType) => string {
  const slots = useMealSlots(date);
  return (meal: MealType) => mealInfo(slots, meal).label;
}

// The meal a new entry belongs to right now (outside React).
export function currentMeal(now = new Date()): MealType {
  const slots = mealSlots(preferencesStore.get().schedule, dayKey(now));
  return mealAt(slots, now.getHours() * 60 + now.getMinutes());
}

export function currentMealLabel(meal: MealType, date: string = dayKey()): string {
  return mealInfo(mealSlots(preferencesStore.get().schedule, date), meal).label;
}

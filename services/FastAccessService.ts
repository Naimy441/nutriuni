// Recently logged foods and the user's own meals, for one-tap re-logging.
// Stored under `fast_access_items` (same format as earlier versions).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { NewTrackedItem, TrackedItem, TrackedNutritionStatus } from './NutritionTracker';

export interface FastAccessItem {
  id: string;
  name: string;
  restaurant: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  serving_size: string;
  type: 'custom' | 'restaurant';
  lastUsed: number;
  useCount: number;
  details?: string;
  nutrition_status?: TrackedNutritionStatus;
}

const STORAGE_KEY = 'fast_access_items';
const MAX_ITEMS = 30;
export const CUSTOM_MEAL_RESTAURANT = 'Custom Meal';

const sameFood = (a: Pick<FastAccessItem, 'name' | 'restaurant' | 'details'>, b: typeof a) =>
  a.name === b.name && a.restaurant === b.restaurant && (a.details ?? '') === (b.details ?? '');

class FastAccessService {
  private static instance: FastAccessService;
  private items: FastAccessItem[] = [];
  private loaded = false;
  private loading: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;

  static getInstance(): FastAccessService {
    if (!FastAccessService.instance) {
      FastAccessService.instance = new FastAccessService();
    }
    return FastAccessService.instance;
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

  load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loading) {
      this.loading = AsyncStorage.getItem(STORAGE_KEY)
        .then(text => {
          const parsed = text ? (JSON.parse(text) as FastAccessItem[]) : [];
          this.items = parsed.map(item => ({ ...item, sodium: Number(item.sodium) || 0 }));
        })
        .catch(() => {
          this.items = [];
        })
        .then(() => {
          this.loaded = true;
          this.emit();
        });
    }
    return this.loading;
  }

  // Most recently used first.
  getItems(): FastAccessItem[] {
    return [...this.items].sort((a, b) => b.lastUsed - a.lastUsed || b.useCount - a.useCount);
  }

  private async persist() {
    this.emit();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
  }

  async addOrUpdateFastAccessItem(tracked: TrackedItem): Promise<void> {
    await this.load();
    const existing = this.items.find(item => sameFood(item, tracked));
    const fields = {
      calories: tracked.calories,
      protein: tracked.protein,
      carbs: tracked.carbs,
      fat: tracked.fat,
      fiber: tracked.fiber,
      sugar: tracked.sugar,
      sodium: tracked.sodium ?? 0,
      serving_size: tracked.serving_size,
      nutrition_status: tracked.nutrition_status,
      details: tracked.details,
    };
    if (existing) {
      Object.assign(existing, fields, { lastUsed: Date.now(), useCount: existing.useCount + 1 });
    } else {
      this.items.push({
        ...fields,
        id: tracked.id,
        name: tracked.name,
        restaurant: tracked.restaurant,
        type: tracked.restaurant === CUSTOM_MEAL_RESTAURANT ? 'custom' : 'restaurant',
        lastUsed: Date.now(),
        useCount: 1,
      });
    }
    // Keep the newest; the user's own meals are never pushed out by restaurant items.
    const custom = this.items.filter(item => item.type === 'custom');
    const restaurant = this.items.filter(item => item.type === 'restaurant')
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ITEMS);
    this.items = [...custom, ...restaurant];
    await this.persist();
  }

  async removeFastAccessItem(itemId: string): Promise<void> {
    await this.load();
    this.items = this.items.filter(item => item.id !== itemId);
    await this.persist();
  }

  // The fields needed to log this food again.
  toNewTrackedItem(item: FastAccessItem): NewTrackedItem {
    return {
      name: item.name,
      restaurant: item.restaurant,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium ?? 0,
      serving_size: item.serving_size,
      details: item.details,
      nutrition_status: item.nutrition_status ?? (item.type === 'custom' ? 'manual' : 'complete'),
    };
  }
}

export const fastAccessService = FastAccessService.getInstance();

export function useFastAccess() {
  useSyncExternalStore(fastAccessService.subscribe, fastAccessService.getRevision);
  useEffect(() => {
    fastAccessService.load();
  }, []);
  const items = fastAccessService.getItems();
  return {
    recents: items.filter(item => item.type === 'restaurant'),
    customMeals: items.filter(item => item.type === 'custom'),
    all: items,
  };
}

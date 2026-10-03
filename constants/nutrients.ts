// Display metadata for the nutrients the app tracks.
import type { DailyNutrition } from '@/services/NutritionTracker';
import type { Theme } from './theme';

export type TrackedNutrient = keyof DailyNutrition;

export interface NutrientInfo {
  key: TrackedNutrient;
  label: string;
  unit: string; // shown after numbers: "cal", "g", "mg"
  // target: aim to reach it (protein, fiber). limit: aim to stay under it.
  // budget: calories, shown as "left".
  kind: 'budget' | 'target' | 'limit';
  about: string;
}

export const NUTRIENTS: Record<TrackedNutrient, NutrientInfo> = {
  calories: {
    key: 'calories', label: 'Calories', unit: 'cal', kind: 'budget',
    about: 'Energy from food. Your daily target comes from your details and goal (Mifflin-St Jeor × activity).',
  },
  protein: {
    key: 'protein', label: 'Protein', unit: 'g', kind: 'target',
    about: 'Builds and repairs muscle and tissue. Your target is 1.6 g per kg of body weight.',
  },
  carbs: {
    key: 'carbs', label: 'Carbs', unit: 'g', kind: 'target',
    about: "Your body's main source of energy. Your target fills the calories left after protein and fat.",
  },
  fat: {
    key: 'fat', label: 'Fat', unit: 'g', kind: 'target',
    about: 'Needed for hormones and absorbing vitamins A, D, E and K. Your target is 28% of calories.',
  },
  fiber: {
    key: 'fiber', label: 'Fiber', unit: 'g', kind: 'target',
    about: 'Supports digestion and steady energy. The guideline is 14 g per 1,000 calories.',
  },
  sugar: {
    key: 'sugar', label: 'Sugar', unit: 'g', kind: 'limit',
    about: 'Total sugars from menu labels. The limit follows American Heart Association advice on added sugar.',
  },
  sodium: {
    key: 'sodium', label: 'Sodium', unit: 'mg', kind: 'limit',
    about: 'Helps nerves and muscles work; too much can raise blood pressure. The guideline is under 2,300 mg a day.',
  },
};

export const MACROS: TrackedNutrient[] = ['protein', 'carbs', 'fat'];
export const MICROS: TrackedNutrient[] = ['fiber', 'sugar', 'sodium'];

export function nutrientColor(theme: Theme, key: TrackedNutrient): string {
  return theme[key];
}

// "62 g", "1,840 mg", "520 cal". Grams under 10 keep one decimal.
export function formatAmount(value: number, unit: string): string {
  const rounded = unit === 'g' && Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded.toLocaleString()}${unit === 'cal' ? ' cal' : ` ${unit}`}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

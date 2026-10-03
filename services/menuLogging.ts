// Turns an order (dish + chosen options) into a food-log entry.
import { computeNutrition, defaultSelection, NutritionResult, Selection, selectionSummary } from './menuNutrition';
import type { MenuItem, RestaurantMenu } from './menuTypes';
import type { NewTrackedItem, TrackedNutritionStatus } from './NutritionTracker';

export interface ManualNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export function servingText(item: MenuItem, result: NutritionResult | null, servings: number): string {
  // The label's serving only describes the order when nothing was added to it.
  const single = result?.base && result.parts.length === 1 && !item.base_quantity
    ? result.base.serving_size ?? '1 order'
    : '1 order';
  if (servings === 1) return single;
  return `${servings} × ${single}`;
}

export function trackedEntryFromOrder(
  menu: RestaurantMenu,
  item: MenuItem,
  selection: Selection,
  servings = 1,
  manual?: ManualNutrition,
): NewTrackedItem {
  const result = computeNutrition(menu, item, selection, servings);
  const common = {
    name: item.name,
    restaurant: menu.name,
    details: selectionSummary(item, selection) || undefined,
  };
  if (manual) {
    // Entered per serving, like the labels.
    const scaled = Object.fromEntries(
      Object.entries(manual).map(([key, value]) => [key, Math.round(value * servings * 10) / 10]),
    ) as unknown as ManualNutrition;
    return { ...common, ...scaled, serving_size: servingText(item, null, servings), nutrition_status: 'manual' };
  }
  if (!result.totals) {
    return {
      ...common,
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
      serving_size: servingText(item, null, servings),
      nutrition_status: 'none',
    };
  }
  const status: TrackedNutritionStatus =
    result.status === 'partial' ? 'partial' : result.estimated ? 'estimated' : 'complete';
  const { calories, protein, carbs, fat, fiber, sugar, sodium } = result.totals;
  return {
    ...common,
    calories, protein, carbs, fat, fiber, sugar, sodium,
    serving_size: servingText(item, result, servings),
    nutrition_status: status,
  };
}

export function quickLogEntry(menu: RestaurantMenu, item: MenuItem): NewTrackedItem {
  return trackedEntryFromOrder(menu, item, defaultSelection(item));
}

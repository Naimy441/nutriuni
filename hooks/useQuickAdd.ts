import { useToast } from '@/components/ui/Toast';
import { relativeDayLabel } from '@/services/dates';
import { MealType } from '@/services/meals';
import { currentMeal, currentMealLabel } from '@/services/preferences';
import { quickLogEntry } from '@/services/menuLogging';
import { canQuickLog } from '@/services/menuNutrition';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import { nutritionTracker, useToday } from '@/services/NutritionTracker';
import { useState } from 'react';

// The "+" on a dish: logs the default order straight away, or opens the item
// sheet when the dish needs choices first (or has no label yet).
export function useQuickAdd(openSheet: (menu: RestaurantMenu, item: MenuItem) => void, target: { date?: string; meal?: MealType } = {}) {
  const toast = useToast();
  const today = useToday();
  const [addingId, setAddingId] = useState<string | null>(null);

  const quickAdd = async (menu: RestaurantMenu, item: MenuItem) => {
    if (!canQuickLog(menu, item)) {
      openSheet(menu, item);
      return;
    }
    const date = target.date ?? today;
    const meal = target.meal ?? currentMeal();
    setAddingId(item.id);
    try {
      const tracked = await nutritionTracker.addTrackedItem(quickLogEntry(menu, item), { date, meal });
      toast.show({
        message: `Added ${item.name} to ${currentMealLabel(meal, date)}${date !== today ? ` · ${relativeDayLabel(date, today)}` : ''}`,
        action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(tracked.id, date) },
      });
    } catch {
      toast.show({ message: "Couldn't save that. Please try again.", tone: 'error' });
    } finally {
      setAddingId(null);
    }
  };

  return { quickAdd, addingId };
}

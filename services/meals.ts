// Meals group the day's log. New entries take the meal the user chose (the
// "+" on a meal section) or one inferred from the time of day.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: MealType; label: string; icon: 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' | 'cafe-outline' }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snacks', icon: 'cafe-outline' },
];

export function mealForTime(date: Date = new Date()): MealType {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 4 * 60 && minutes < 11 * 60) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 15 * 60) return 'lunch';
  if (minutes >= 17 * 60 && minutes < 22 * 60) return 'dinner';
  return 'snack';
}

export function mealLabel(meal: MealType): string {
  return MEALS.find(m => m.key === meal)?.label ?? 'Snacks';
}

export function isMealType(value: unknown): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}

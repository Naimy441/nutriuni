// The day's meals under the user's schedule on one line, used wherever a meal
// is chosen. A meal outside the schedule stays selectable if it's the value.
import { useMealSlots } from '@/services/preferences';
import { MealType } from '@/services/meals';
import { mealInfo } from '@/services/schedule';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Segmented } from './ui/Segmented';

const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// The meals that can be picked: the schedule's, plus the current value.
export function useMealOptions(value: MealType, date?: string): { value: MealType; label: string }[] {
  const slots = useMealSlots(date);
  return ORDER
    .filter(meal => meal === value || slots.some(slot => slot.meal === meal))
    .map(meal => ({ value: meal, label: mealInfo(slots, meal).label }));
}

export function MealPicker({ value, onChange, date, style }: {
  value: MealType;
  onChange: (meal: MealType) => void;
  date?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const options = useMealOptions(value, date);
  if (options.length < 2) return null; // one meal a day: nothing to choose
  return <Segmented options={options} value={value} onChange={onChange} style={style} />;
}

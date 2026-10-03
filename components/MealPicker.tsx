// Breakfast / Lunch / Dinner / Snacks on one line, used wherever a meal is chosen.
import { MEALS, MealType } from '@/services/meals';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Segmented } from './ui/Segmented';

const OPTIONS = MEALS.map(meal => ({ value: meal.key, label: meal.label }));

export function MealPicker({ value, onChange, style }: { value: MealType; onChange: (meal: MealType) => void; style?: StyleProp<ViewStyle> }) {
  return <Segmented options={OPTIONS} value={value} onChange={onChange} style={style} />;
}

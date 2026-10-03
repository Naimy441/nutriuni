import { DayView } from '@/components/DayView';
import { space } from '@/constants/theme';
import { dayKey, longDayLabel } from '@/services/dates';
import { useToday } from '@/services/NutritionTracker';
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const date = typeof params.date === 'string' && DATE_PATTERN.test(params.date) ? params.date : dayKey();
  return (
    <>
      <Stack.Screen options={{ title: longDayLabel(date) }} />
      <DayView date={date} today={today} bottomPadding={insets.bottom + space.xxxl} header={null} />
    </>
  );
}

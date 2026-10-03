// "Up next" on Today: the next meal's planned size with a few dishes that
// fit it, picked to keep the week on track.
import { menuItemFor, useLogSuggestion, useMealPlan, useSuggestions } from '@/hooks/usePlanner';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import type { Suggestion } from '@/services/planner';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { MenuItemSheet } from './MenuItemSheet';
import { MealPlanCard } from './PlanCards';
import { SectionHeader } from './ui/SectionHeader';

export function UpNext({ date }: { date: string }) {
  const router = useRouter();
  const { meals } = useMealPlan(date);
  const next = meals.find(meal => meal.state === 'planned');
  const suggestions = useSuggestions(date, next, 3);
  const logSuggestion = useLogSuggestion();
  const [sheet, setSheet] = useState<{ menu: RestaurantMenu; item: MenuItem } | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  if (!next) return null;

  const log = async (suggestion: Suggestion) => {
    setLogging(suggestion.key);
    try {
      await logSuggestion(suggestion, date, next.meal);
    } finally {
      setLogging(null);
    }
  };

  return (
    <View>
      <SectionHeader
        title="Up next"
        subtitle="Sized to keep your week on track"
        actionLabel="Full plan"
        onAction={() => router.push('/plan')}
        style={{ paddingHorizontal: 4 }}
      />
      <MealPlanCard
        target={next}
        suggestions={suggestions}
        onOpen={(_, part) => setSheet(menuItemFor(part))}
        onLog={log}
        loggingKey={logging}
      />
      <MenuItemSheet menu={sheet?.menu ?? null} item={sheet?.item ?? null} onClose={() => setSheet(null)} date={date} meal={next.meal} />
    </View>
  );
}

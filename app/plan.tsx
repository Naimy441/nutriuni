import { MenuItemSheet } from '@/components/MenuItemSheet';
import { dayChipLabel, MealPlanCard, WeekCard } from '@/components/PlanCards';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { menuItemFor, useLogSuggestion, useMealPlan, useSuggestions, useWeekPlan } from '@/hooks/usePlanner';
import { goalsStore, useGoals } from '@/services/goals';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import { useToday } from '@/services/NutritionTracker';
import { MealTarget, planHorizon, PLANNER, Suggestion } from '@/services/planner';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const { planner } = useGoals();
  const horizon = planHorizon(today);
  const [chosen, setChosen] = useState(today);
  const date = horizon.includes(chosen) ? chosen : today;
  const week = useWeekPlan();
  const { day, meals } = useMealPlan(date);
  const [sheet, setSheet] = useState<{ menu: RestaurantMenu; item: MenuItem; meal: MealTarget['meal'] } | null>(null);

  const adjustment = day.adjustment;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]} showsVerticalScrollIndicator={false}>
        <WeekCard plan={week} />

        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {horizon.map(d => (
              <Chip key={d} label={dayChipLabel(d, today)} selected={d === date} onPress={() => setChosen(d)} />
            ))}
          </ScrollView>

          <Card style={styles.dayCard}>
            <View style={styles.dayRow}>
              <View style={styles.flex}>
                <AppText variant="caption" tone="secondary">{dayChipLabel(date, today)}’s target</AppText>
                <AppText variant="title2" numeric>
                  {formatNumber(day.target)}
                  <AppText variant="subhead" tone="secondary"> cal</AppText>
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" tone="secondary">Protein</AppText>
                <AppText variant="title2" numeric color={theme.protein}>
                  {formatNumber(day.proteinTarget)}
                  <AppText variant="subhead" tone="secondary"> g</AppText>
                </AppText>
              </View>
            </View>
            <AppText variant="footnote" tone="secondary">
              {!week.balanced
                ? 'Your daily target, with weekly balancing off.'
                : adjustment === 0
                  ? 'Your usual daily target — the week is on track.'
                  : adjustment < 0
                    ? `${formatNumber(-adjustment)} lighter than usual to balance earlier days${day.limited ? ', as much as we’d safely trim' : ''}.`
                    : `${formatNumber(adjustment)} more than usual, since earlier days came in under${day.limited ? ' (capped so no day is too big)' : ''}.`}
            </AppText>
          </Card>
        </View>

        <View style={styles.section}>
          {meals.map(target => (
            <MealSuggestions
              key={target.meal}
              date={date}
              target={target}
              onOpen={(found) => setSheet({ ...found, meal: target.meal })}
            />
          ))}
        </View>

        <Card style={styles.how}>
          <AppText variant="headline">How your plan works</AppText>
          <Explainer icon="calendar-outline" text={`Your week matters more than any one day. Your weekly budget is 7 × your daily target: ${formatNumber(week.weekly.calories)} cal and ${formatNumber(week.weekly.protein)} g protein.`} />
          <Explainer icon="swap-vertical-outline" text="Go over one day and the days after get a little lighter; come in under and they get a little more. Each day's target is set before it starts, so it doesn't move while you eat." />
          <Explainer icon="shield-checkmark-outline" text={`No day is planned more than ${Math.round(PLANNER.maxDecrease * 100)}% below or ${Math.round(PLANNER.maxIncrease * 100)}% above your daily target, or under a safe minimum, so you never have to starve or stuff yourself to catch up. Meals keep a sensible minimum too.`} />
          <Explainer icon="help-circle-outline" text="Days you didn't log, or only partly logged, count as on target, so a forgotten log never turns into extra food." />
          <Explainer icon="restaurant-outline" text="Suggestions only use dishes with published Duke NetNutrition labels and meals you've saved, from places open at that meal." />
        </Card>

        <Card padded={false}>
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <AppText variant="callout" weight="600">Balance my week</AppText>
              <AppText variant="footnote" tone="tertiary">Off: every day uses your plain daily target.</AppText>
            </View>
            <Switch
              value={planner.balanceWeek}
              onValueChange={balanceWeek => goalsStore.savePlanner({ ...planner, balanceWeek })}
              trackColor={{ true: theme.brand, false: theme.fillStrong }}
              accessibilityLabel="Balance my week"
            />
          </View>
        </Card>
      </ScrollView>

      <MenuItemSheet
        menu={sheet?.menu ?? null}
        item={sheet?.item ?? null}
        onClose={() => setSheet(null)}
        date={date}
        meal={sheet?.meal}
      />
    </View>
  );
}

function MealSuggestions({ date, target, onOpen }: {
  date: string;
  target: MealTarget;
  onOpen: (found: { menu: RestaurantMenu; item: MenuItem }) => void;
}) {
  const suggestions = useSuggestions(date, target, 4);
  const logSuggestion = useLogSuggestion();
  const [logging, setLogging] = useState<string | null>(null);
  const log = async (suggestion: Suggestion) => {
    setLogging(suggestion.key);
    try {
      await logSuggestion(suggestion, date, target.meal);
    } finally {
      setLogging(null);
    }
  };
  return (
    <MealPlanCard
      target={target}
      suggestions={suggestions}
      loggingKey={logging}
      onLog={log}
      onOpen={(_, part) => {
        const found = menuItemFor(part);
        if (found) onOpen(found);
      }}
    />
  );
}

function Explainer({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.explainer}>
      <Ionicons name={icon} size={18} color={theme.brandText} style={styles.explainerIcon} />
      <AppText variant="footnote" tone="secondary" style={styles.flex}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: space.md,
  },
  chips: {
    gap: space.sm,
  },
  dayCard: {
    gap: space.sm,
  },
  dayRow: {
    flexDirection: 'row',
    gap: space.lg,
  },
  how: {
    gap: space.md,
  },
  explainer: {
    flexDirection: 'row',
    gap: space.md,
  },
  explainerIcon: {
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
});

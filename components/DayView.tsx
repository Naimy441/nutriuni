// One day's log: calories-left ring, nutrients, the day's meals and one-tap
// re-logging. Used by the Today tab and by past days opened from Progress.
import { MACROS, MICROS, NUTRIENTS, TrackedNutrient, formatAmount, formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { useDayTargets, useWeekPlan } from '@/hooks/usePlanner';
import { timeLabel } from '@/services/dates';
import { fastAccessService, FastAccessItem, sourceLabel, useFastAccess } from '@/services/FastAccessService';
import { useGoals } from '@/services/goals';
import { MEALS, MealType, mealForTime, mealLabel } from '@/services/meals';
import { formatTrackedCalories, mealOf, nutritionTracker, TrackedItem, useDayLog, useLoggedDays } from '@/services/NutritionTracker';
import { weekBrief, WeekPlan } from '@/services/planner';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { NutrientSheet } from './NutrientSheet';
import { TrackedItemSheet, TrackedSelection } from './TrackedItemSheet';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { IconButton } from './ui/IconButton';
import { PressableScale, triggerHaptic } from './ui/PressableScale';
import { ProgressBar } from './ui/ProgressBar';
import { ProgressRing } from './ui/ProgressRing';
import { SectionHeader } from './ui/SectionHeader';
import { useToast } from './ui/Toast';
import { UpNext } from './UpNext';

interface DayViewProps {
  date: string;
  today: string;
  header?: React.ReactNode;
  bottomPadding: number;
}

export function DayView({ date, today, header, bottomPadding }: DayViewProps) {
  const router = useRouter();
  const { log } = useDayLog(date);
  const { goals: baseGoals } = useGoals();
  // Calorie and protein targets for this day after balancing the week.
  const targets = useDayTargets(date);
  const goals = { ...baseGoals, calories: targets.target, protein: targets.proteinTarget };
  const week = useWeekPlan(date);
  const loggedDays = useLoggedDays();
  const [selected, setSelected] = useState<TrackedSelection | null>(null);
  const [nutrient, setNutrient] = useState<TrackedNutrient | null>(null);
  const isToday = date === today;

  const byMeal = useMemo(() => {
    const groups: Record<MealType, TrackedItem[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const item of log.items) groups[mealOf(item)].push(item);
    for (const key of Object.keys(groups) as MealType[]) groups[key].sort((a, b) => a.timestamp - b.timestamp);
    return groups;
  }, [log.items]);

  const openLog = (meal?: MealType) => router.push({ pathname: '/log', params: { date, ...(meal ? { meal } : {}) } });
  const firstTime = isToday && log.items.length === 0 && loggedDays.length === 0;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <SummaryCard
          totals={log.totals}
          goals={goals}
          adjustment={week.balanced ? targets.adjustment : 0}
          week={isToday ? week : null}
          onSelect={setNutrient}
          onOpenPlan={() => router.push('/plan')}
        />

        {firstTime && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={styles.welcome}>
              <View style={styles.welcomeText}>
                <AppText variant="title3">Log your first meal</AppText>
                <AppText variant="subhead" tone="secondary">
                  Search every Duke dining menu with nutrition built in, or add calories yourself.
                </AppText>
              </View>
              <View style={styles.welcomeActions}>
                <Button title="Log food" icon="add" size="md" onPress={() => openLog()} style={styles.flex} />
                <Button title="What's open" icon="restaurant-outline" size="md" variant="tinted" onPress={() => router.navigate('/menus')} style={styles.flex} />
              </View>
            </Card>
          </Animated.View>
        )}

        {isToday && !firstTime && <UpNext date={date} />}

        <View>
          <SectionHeader title="Meals" style={styles.inset} />
          <Card padded={false} style={styles.clip}>
            {MEALS.map((meal, index) => (
              <MealSection
                key={meal.key}
                meal={meal}
                items={byMeal[meal.key]}
                date={date}
                divider={index > 0}
                onAdd={() => openLog(meal.key)}
                onSelect={item => setSelected({ item, date })}
              />
            ))}
          </Card>
        </View>

        <RecentsRow date={date} />

        <Pressable onPress={() => router.push('/sources')} accessibilityRole="link" style={styles.footer}>
          <AppText variant="caption" tone="tertiary" align="center">
            Nutrition from Duke NetNutrition labels. Estimates, not medical advice.{' '}
            <AppText variant="caption" tone="brand" weight="600">Sources</AppText>
          </AppText>
        </Pressable>
      </ScrollView>

      <TrackedItemSheet selection={selected} onDismiss={() => setSelected(null)} />
      <NutrientSheet
        nutrient={nutrient}
        log={log}
        goal={nutrient ? goals[nutrient] : 0}
        onDismiss={() => setNutrient(null)}
      />
    </>
  );
}

// ---- summary ----

function SummaryCard({
  totals, goals, adjustment, week, onSelect, onOpenPlan,
}: {
  totals: Record<TrackedNutrient, number>;
  goals: Record<TrackedNutrient, number>;
  adjustment: number; // today's target versus the plain daily goal
  week: WeekPlan | null; // shown for today only
  onSelect: (key: TrackedNutrient) => void;
  onOpenPlan: () => void;
}) {
  const theme = useTheme();
  const eaten = totals.calories;
  const left = goals.calories - eaten;
  const over = left < 0;
  return (
    <Card padded={false} style={styles.clip}>
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <PressableScale
            onPress={() => onSelect('calories')}
            scaleTo={0.96}
            haptic="selection"
            accessibilityLabel={`${formatNumber(Math.abs(left))} calories ${over ? 'over' : 'left'}. ${formatNumber(eaten)} eaten of ${formatNumber(goals.calories)}.`}
            accessibilityHint="Shows where today's calories came from"
          >
            <ProgressRing
              size={148}
              stroke={13}
              progress={goals.calories ? eaten / goals.calories : 0}
              color={theme.calories}
              overColor={theme.warning}
            >
              <AnimatedNumber value={Math.abs(left)} variant="title1" weight="800" />
              <AppText variant="footnote" tone={over ? 'warning' : 'secondary'} weight="600">
                {over ? 'cal over' : 'cal left'}
              </AppText>
            </ProgressRing>
          </PressableScale>
          <View style={styles.summaryStats}>
            <Stat label="Eaten" value={formatNumber(eaten)} />
            <Stat
              label="Target"
              value={formatNumber(goals.calories)}
              note={adjustment ? `${adjustment > 0 ? '+' : '−'}${formatNumber(Math.abs(adjustment))} for your week` : undefined}
            />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.separator }]} />

        <View style={styles.nutrientGrid}>
          {MACROS.map(key => (
            <NutrientCell key={key} nutrient={key} total={totals[key]} goal={goals[key]} onPress={() => onSelect(key)} />
          ))}
        </View>
        <View style={styles.nutrientGrid}>
          {MICROS.map(key => (
            <NutrientCell key={key} nutrient={key} total={totals[key]} goal={goals[key]} onPress={() => onSelect(key)} small />
          ))}
        </View>
      </View>

      {week && (
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onOpenPlan();
          }}
          style={({ pressed }) => [styles.weekRow, { borderTopColor: theme.separator }, pressed && { backgroundColor: theme.fill }]}
          accessibilityRole="button"
          accessibilityHint="Opens your meal plan for the week"
        >
          <Ionicons name="calendar-outline" size={16} color={theme.brandText} />
          <AppText variant="footnote" weight="600" tone="secondary" style={styles.flex} numberOfLines={1}>
            {weekBrief(week)}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={theme.brandText} />
        </Pressable>
      )}
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <AppText variant="title3" numeric>{value}</AppText>
      {note ? <AppText variant="caption" tone="brand" weight="600">{note}</AppText> : null}
    </View>
  );
}

// Macros on the first row, fiber/sugar/sodium on a smaller second row, all on
// the same three columns.
function NutrientCell({ nutrient, total, goal, onPress, small }: {
  nutrient: TrackedNutrient;
  total: number;
  goal: number;
  onPress: () => void;
  small?: boolean;
}) {
  const theme = useTheme();
  const info = NUTRIENTS[nutrient];
  const warn = info.kind === 'limit' && goal > 0 && total > goal;
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${info.label}: ${formatAmount(total, info.unit)} of ${formatAmount(goal, info.unit)}${info.kind === 'limit' ? ' limit' : ''}`}
    >
      <AppText variant="caption" tone="secondary">{info.label}</AppText>
      <AppText variant={small ? 'subhead' : 'headline'} weight={small ? '600' : undefined} numeric numberOfLines={1} color={warn ? theme.warning : theme.text}>
        {formatNumber(total)}
        <AppText variant="caption" tone="tertiary" numeric>{` / ${formatNumber(goal)}${info.unit === 'mg' ? '' : ' g'}`}</AppText>
      </AppText>
      <ProgressBar progress={goal ? total / goal : 0} color={warn ? theme.warning : theme[nutrient]} height={small ? 4 : 6} />
    </Pressable>
  );
}

// ---- recents ----

function RecentsRow({ date }: { date: string }) {
  const theme = useTheme();
  const toast = useToast();
  const { all } = useFastAccess();
  const items = all.slice(0, 12);
  if (!items.length) return null;

  const relog = async (item: FastAccessItem) => {
    const meal = mealForTime();
    const added = await nutritionTracker.addTrackedItem(fastAccessService.toNewTrackedItem(item), { date, meal });
    toast.show({
      message: `Added ${item.name} to ${mealLabel(meal)}`,
      action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(added.id, date) },
    });
  };

  return (
    <View>
      <SectionHeader title="Eat it again" style={styles.inset} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recents}>
        {items.map(item => (
          <PressableScale
            key={item.id}
            onPress={() => relog(item)}
            haptic="light"
            scaleTo={0.95}
            accessibilityLabel={`Log ${item.name}, ${formatTrackedCalories(item)}`}
            style={[styles.recent, { backgroundColor: theme.surface, borderColor: theme.separator }]}
          >
            <View style={styles.recentText}>
              <AppText variant="subhead" weight="600" numberOfLines={1}>{item.name}</AppText>
              <AppText variant="caption" tone="tertiary" numeric numberOfLines={1}>{formatTrackedCalories(item)}</AppText>
            </View>
            <Ionicons name="add-circle" size={22} color={theme.brand} />
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

// ---- meals ----

function MealSection({
  meal, items, date, divider, onAdd, onSelect,
}: {
  meal: (typeof MEALS)[number];
  items: TrackedItem[];
  date: string;
  divider: boolean;
  onAdd: () => void;
  onSelect: (item: TrackedItem) => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const calories = items.reduce((sum, item) => sum + (item.nutrition_status === 'none' ? 0 : item.calories), 0);

  const remove = async (item: TrackedItem) => {
    triggerHaptic('medium');
    await nutritionTracker.removeItem(item.id, date);
    toast.show({
      message: `Removed ${item.name}`,
      icon: 'trash-outline',
      action: { label: 'Undo', onPress: () => nutritionTracker.restoreItem(item, date) },
    });
  };

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}>
      <View style={styles.mealHeader}>
        <Ionicons name={meal.icon} size={18} color={theme.brandText} />
        <AppText variant="headline" accessibilityRole="header" style={styles.flex}>{meal.label}</AppText>
        {items.length > 0 && (
          <AppText variant="subhead" tone="secondary" numeric>{formatNumber(calories)} cal</AppText>
        )}
        <IconButton icon="add" size={32} variant="filled" color={theme.brandText} accessibilityLabel={`Add to ${meal.label}`} onPress={onAdd} />
      </View>
      {items.map(item => (
        <Animated.View key={item.id} entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(220)}>
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={40}
            overshootRight={false}
            renderRightActions={() => (
              <Pressable
                onPress={() => remove(item)}
                style={[styles.deleteAction, { backgroundColor: theme.danger }]}
                accessibilityLabel={`Delete ${item.name}`}
              >
                <Ionicons name="trash" size={20} color="#FFFFFF" />
                <AppText variant="caption" weight="700" color="#FFFFFF">Delete</AppText>
              </Pressable>
            )}
          >
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.itemRow, { backgroundColor: pressed ? theme.fill : theme.surface }]}
              accessibilityRole="button"
              accessibilityHint="Shows details. Swipe left to delete."
            >
              <View style={styles.flex}>
                <AppText variant="callout" weight="500" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="footnote" tone="tertiary" numberOfLines={1}>
                  {[timeLabel(item.timestamp), sourceLabel(item.restaurant), item.details].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <AppText variant="subhead" weight="600" numeric tone={item.nutrition_status === 'none' ? 'tertiary' : 'primary'}>
                {formatTrackedCalories(item)}
              </AppText>
            </Pressable>
          </ReanimatedSwipeable>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xxl,
  },
  flex: {
    flex: 1,
  },
  inset: {
    paddingHorizontal: space.xs,
  },
  clip: {
    overflow: 'hidden',
  },
  summary: {
    padding: space.xl,
    gap: space.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxl,
  },
  summaryStats: {
    flex: 1,
    gap: space.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  nutrientGrid: {
    flexDirection: 'row',
    gap: space.lg,
  },
  cell: {
    flex: 1,
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  welcome: {
    gap: space.lg,
  },
  welcomeText: {
    gap: space.xs,
  },
  welcomeActions: {
    flexDirection: 'row',
    gap: space.md,
  },
  recents: {
    gap: space.sm,
    paddingRight: space.lg,
  },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    maxWidth: 230,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentText: {
    flexShrink: 1,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.md,
    paddingVertical: space.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg + 18 + space.md, // lines up with the meal name
    paddingRight: space.lg,
    paddingVertical: space.sm + 2,
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  footer: {
    paddingHorizontal: space.xl,
  },
});

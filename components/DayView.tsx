// One day's log: calories-left ring, macros, the day's meals and one-tap
// re-logging. Used by the Today tab and by past days opened from Progress.
import { MACROS, MICROS, NUTRIENTS, TrackedNutrient, formatAmount, formatNumber } from '@/constants/nutrients';
import { radius, shadow, space, useTheme } from '@/constants/theme';
import { timeLabel } from '@/services/dates';
import { fastAccessService, FastAccessItem, sourceLabel, useFastAccess } from '@/services/FastAccessService';
import { useGoals } from '@/services/goals';
import { useDayTargets, useWeekPlan } from '@/hooks/usePlanner';
import { MEALS, MealType, mealForTime, mealLabel } from '@/services/meals';
import { formatTrackedCalories, mealOf, nutritionTracker, TrackedItem, useDayLog, useLoggedDays } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { NutrientSheet } from './NutrientSheet';
import { WeekCard } from './PlanCards';
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

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <SummaryCard totals={log.totals} goals={goals} adjustment={week.balanced ? targets.adjustment : 0} onSelect={setNutrient} />

        {log.items.length === 0 && isToday && loggedDays.length === 0 && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={styles.welcome}>
              <View style={styles.welcomeText}>
                <AppText variant="title3">Log your first meal</AppText>
                <AppText variant="subhead" tone="secondary">
                  Search every Duke dining menu with nutrition built in, re-log a favorite, or add calories yourself.
                </AppText>
              </View>
              <View style={styles.welcomeActions}>
                <Button title="Log food" icon="add" size="md" onPress={() => openLog()} style={styles.flex} />
                <Button title="What's open" icon="restaurant-outline" size="md" variant="tinted" onPress={() => router.navigate('/menus')} style={styles.flex} />
              </View>
            </Card>
          </Animated.View>
        )}

        {isToday && <WeekCard plan={week} onPress={() => router.push('/plan')} />}
        {isToday && <UpNext date={date} />}

        <View style={styles.meals}>
          {MEALS.map(meal => (
            <MealSection
              key={meal.key}
              meal={meal}
              items={byMeal[meal.key]}
              date={date}
              onAdd={() => openLog(meal.key)}
              onSelect={item => setSelected({ item, date })}
            />
          ))}
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
  totals, goals, adjustment, onSelect,
}: {
  totals: Record<TrackedNutrient, number>;
  goals: Record<TrackedNutrient, number>;
  adjustment: number; // today's target versus the plain daily goal
  onSelect: (key: TrackedNutrient) => void;
}) {
  const theme = useTheme();
  const eaten = totals.calories;
  const left = goals.calories - eaten;
  const over = left < 0;
  return (
    <Card style={styles.summary}>
      <View style={styles.summaryTop}>
        <PressableScale
          onPress={() => onSelect('calories')}
          scaleTo={0.96}
          haptic="selection"
          accessibilityLabel={`${formatNumber(Math.abs(left))} calories ${over ? 'over' : 'left'}. ${formatNumber(eaten)} eaten of ${formatNumber(goals.calories)}.`}
          accessibilityHint="Shows where today's calories came from"
        >
          <ProgressRing
            size={156}
            stroke={14}
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
          <Stat
            icon="flag-outline"
            label="Target"
            value={formatNumber(goals.calories)}
            note={adjustment ? `${adjustment > 0 ? '+' : '−'}${formatNumber(Math.abs(adjustment))} for your week` : undefined}
            color={theme.textSecondary}
          />
          <Stat icon="restaurant-outline" label="Eaten" value={formatNumber(eaten)} color={theme.calories} />
          <Stat
            icon={over ? 'alert-circle-outline' : 'leaf-outline'}
            label={over ? 'Over' : 'Remaining'}
            value={formatNumber(Math.abs(left))}
            color={over ? theme.warning : theme.textSecondary}
          />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.separator }]} />

      <View style={styles.macros}>
        {MACROS.map(key => (
          <Pressable
            key={key}
            style={styles.macro}
            onPress={() => {
              triggerHaptic('selection');
              onSelect(key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${NUTRIENTS[key].label}: ${formatAmount(totals[key], 'g')} of ${formatAmount(goals[key], 'g')}`}
          >
            <AppText variant="caption" tone="secondary">{NUTRIENTS[key].label}</AppText>
            <AppText variant="headline" numeric>
              {Math.round(totals[key])}
              <AppText variant="footnote" tone="tertiary" numeric> / {Math.round(goals[key])} g</AppText>
            </AppText>
            <ProgressBar progress={goals[key] ? totals[key] / goals[key] : 0} color={theme[key]} height={6} />
          </Pressable>
        ))}
      </View>

      <View style={styles.micros}>
        {MICROS.map(key => {
          const info = NUTRIENTS[key];
          const warn = info.kind === 'limit' && goals[key] > 0 && totals[key] > goals[key];
          return (
            <PressableScale
              key={key}
              onPress={() => onSelect(key)}
              haptic="selection"
              scaleTo={0.95}
              style={[styles.micro, { backgroundColor: warn ? theme.warningSoft : theme.fill }]}
              accessibilityLabel={`${info.label}: ${formatAmount(totals[key], info.unit)} of ${formatAmount(goals[key], info.unit)}`}
            >
              <View style={[styles.dot, { backgroundColor: theme[key] }]} />
              <AppText variant="caption" tone="secondary">{info.label}</AppText>
              <AppText variant="caption" weight="700" numeric color={warn ? theme.warning : theme.text}>
                {formatNumber(totals[key])}
                <AppText variant="caption" tone="tertiary" numeric>/{formatNumber(goals[key])}</AppText>
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

function Stat({ icon, label, value, color, note }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
  note?: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={color} />
      <View style={styles.flex}>
        <AppText variant="caption" tone="secondary">{label}</AppText>
        <AppText variant="headline" numeric>{value}</AppText>
        {note ? <AppText variant="micro" tone="brand" numberOfLines={1}>{note}</AppText> : null}
      </View>
    </View>
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
      <SectionHeader title="Eat it again" subtitle="One tap adds it to this day" style={styles.inset} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recents}>
        {items.map(item => (
          <PressableScale
            key={item.id}
            onPress={() => relog(item)}
            haptic="light"
            scaleTo={0.95}
            accessibilityLabel={`Log ${item.name}, ${formatTrackedCalories(item)}`}
            style={[styles.recent, { backgroundColor: theme.surface, borderColor: theme.separator }, shadow(theme, 1)]}
          >
            <AppText variant="subhead" weight="600" numberOfLines={2} style={styles.recentName}>{item.name}</AppText>
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>{item.type === 'custom' ? 'My meal' : item.restaurant}</AppText>
            <View style={styles.recentFooter}>
              <AppText variant="footnote" weight="700" numeric tone="brand">{formatTrackedCalories(item)}</AppText>
              <View style={[styles.recentAdd, { backgroundColor: theme.brandSoft }]}>
                <Ionicons name="add" size={16} color={theme.brandText} />
              </View>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

// ---- meals ----

function MealSection({
  meal, items, date, onAdd, onSelect,
}: {
  meal: (typeof MEALS)[number];
  items: TrackedItem[];
  date: string;
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
    <Animated.View layout={LinearTransition.duration(220)}>
      <Card padded={false} style={styles.mealCard}>
        <View style={styles.mealHeader}>
          <View style={[styles.mealIcon, { backgroundColor: theme.brandSoft }]}>
            <Ionicons name={meal.icon} size={18} color={theme.brandText} />
          </View>
          <View style={styles.flex}>
            <AppText variant="headline" accessibilityRole="header">{meal.label}</AppText>
            <AppText variant="footnote" tone="secondary" numeric>
              {items.length ? `${formatNumber(calories)} cal · ${items.length} item${items.length === 1 ? '' : 's'}` : 'Nothing yet'}
            </AppText>
          </View>
          <IconButton icon="add" variant="filled" color={theme.brandText} accessibilityLabel={`Add to ${meal.label}`} onPress={onAdd} />
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
                style={({ pressed }) => [
                  styles.itemRow,
                  { backgroundColor: pressed ? theme.fill : theme.surface, borderTopColor: theme.separator },
                ]}
                accessibilityRole="button"
                accessibilityHint="Shows details. Swipe left to delete."
              >
                <View style={styles.flex}>
                  <AppText variant="callout" weight="600" numberOfLines={1}>{item.name}</AppText>
                  <AppText variant="footnote" tone="tertiary" numberOfLines={1}>
                    {[timeLabel(item.timestamp), sourceLabel(item.restaurant), item.details].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <AppText variant="callout" weight="600" numeric tone={item.nutrition_status === 'none' ? 'tertiary' : 'primary'}>
                  {formatTrackedCalories(item)}
                </AppText>
              </Pressable>
            </ReanimatedSwipeable>
          </Animated.View>
        ))}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xl,
  },
  flex: {
    flex: 1,
  },
  inset: {
    paddingHorizontal: space.xs,
  },
  summary: {
    padding: space.xl,
    gap: space.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  summaryStats: {
    flex: 1,
    gap: space.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  macros: {
    flexDirection: 'row',
    gap: space.lg,
  },
  macro: {
    flex: 1,
    gap: 4,
  },
  micros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  micro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.md,
    height: 30,
    borderRadius: radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
    gap: space.md,
    paddingRight: space.lg,
    paddingBottom: space.xs,
  },
  recent: {
    width: 152,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentName: {
    minHeight: 38,
  },
  recentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  recentAdd: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meals: {
    gap: space.md,
  },
  mealCard: {
    overflow: 'hidden',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  mealIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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

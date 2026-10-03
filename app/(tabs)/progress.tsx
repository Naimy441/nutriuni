import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { useTabBarSpace } from '@/components/ui/TabBar';
import { formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { addDays, dateFromKey, relativeDayLabel, weekdayInitial } from '@/services/dates';
import { useGoals } from '@/services/goals';
import { DailyLog, useDayLogs, useLoggedDays, useToday } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Range = 'week' | 'month';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30 };
const CHART_HEIGHT = 160;

function streakOf(logged: Set<string>, today: string): number {
  // A streak still counts if today isn't logged yet.
  let day = logged.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (logged.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarSpace();
  const router = useRouter();
  const today = useToday();
  const { goals } = useGoals();
  const [range, setRange] = useState<Range>('week');
  const loggedDays = useLoggedDays();
  const logged = useMemo(() => new Set(loggedDays), [loggedDays]);

  const days = useMemo(
    () => Array.from({ length: RANGE_DAYS[range] }, (_, i) => addDays(today, i - RANGE_DAYS[range] + 1)),
    [range, today],
  );
  const logs = useDayLogs(days);
  const recentDays = useMemo(() => [...loggedDays].reverse().slice(0, 60), [loggedDays]);
  const history = useDayLogs(recentDays);
  const [showAll, setShowAll] = useState(false);

  const withFood = logs.filter(log => log.items.length > 0);
  const average = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    withFood.length ? withFood.reduce((sum, log) => sum + log.totals[key], 0) / withFood.length : 0;
  const avgCalories = average('calories');
  const avgProtein = average('protein');
  const macroCalories = { protein: average('protein') * 4, carbs: average('carbs') * 4, fat: average('fat') * 9 };
  const macroTotal = macroCalories.protein + macroCalories.carbs + macroCalories.fat;
  const streak = streakOf(logged, today);
  const onTarget = withFood.filter(log => Math.abs(log.totals.calories - goals.calories) <= goals.calories * 0.1).length;

  const openDay = (date: string) => router.push({ pathname: '/day/[date]', params: { date } });

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="largeTitle" accessibilityRole="header">Progress</AppText>
          <AppText variant="subhead" tone="secondary">
            {loggedDays.length ? `${loggedDays.length} day${loggedDays.length === 1 ? '' : 's'} logged in total` : 'Your trends appear as you log'}
          </AppText>
        </View>

        <Segmented
          options={[{ value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' }]}
          value={range}
          onChange={setRange}
        />

        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <AppText variant="caption" tone="secondary">Average on logged days</AppText>
              <AppText variant="title1" numeric>
                {withFood.length ? formatNumber(avgCalories) : '—'}
                <AppText variant="subhead" tone="secondary"> cal</AppText>
              </AppText>
            </View>
            <View style={styles.legend}>
              <View style={[styles.legendLine, { borderColor: theme.textTertiary }]} />
              <AppText variant="caption" tone="secondary" numeric>Target {formatNumber(goals.calories)}</AppText>
            </View>
          </View>
          <CalorieChart logs={logs} goal={goals.calories} today={today} range={range} onSelect={openDay} />
        </Card>

        <Card padded={false}>
          <View style={styles.statsRow}>
            <StatTile icon="flame-outline" color={theme.warning} label="Logging streak" value={streak ? `${streak} day${streak === 1 ? '' : 's'}` : '—'} />
            <View style={[styles.vDivider, { backgroundColor: theme.separator }]} />
            <StatTile icon="calendar-outline" color={theme.brandText} label="Days logged" value={`${withFood.length} of ${days.length}`} />
          </View>
          <View style={[styles.hDivider, { backgroundColor: theme.separator }]} />
          <View style={styles.statsRow}>
            <StatTile icon="barbell-outline" color={theme.protein} label="Avg protein" value={withFood.length ? `${formatNumber(avgProtein)} g` : '—'} detail={`Target ${formatNumber(goals.protein)} g`} />
            <View style={[styles.vDivider, { backgroundColor: theme.separator }]} />
            <StatTile icon="locate-outline" color={theme.calories} label="Near target" value={withFood.length ? `${onTarget} day${onTarget === 1 ? '' : 's'}` : '—'} detail="Within 10%" />
          </View>
        </Card>

        {macroTotal > 0 && (
          <Card style={styles.macroCard}>
            <AppText variant="headline">Where your calories come from</AppText>
            <View style={styles.macroBar}>
              {(['protein', 'carbs', 'fat'] as const).map(key => (
                <View key={key} style={{ flex: macroCalories[key] || 0.0001, backgroundColor: theme[key] }} />
              ))}
            </View>
            <View style={styles.macroLegend}>
              {(['protein', 'carbs', 'fat'] as const).map(key => (
                <View key={key} style={styles.macroLegendItem}>
                  <View style={[styles.dot, { backgroundColor: theme[key] }]} />
                  <AppText variant="footnote" tone="secondary">
                    {key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat'}{' '}
                    <AppText variant="footnote" weight="700" numeric>{Math.round((macroCalories[key] / macroTotal) * 100)}%</AppText>
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        )}

        <View style={styles.history}>
          <AppText variant="title3" accessibilityRole="header" style={styles.inset}>History</AppText>
          {history.length ? (
            <Card padded={false} style={styles.clip}>
              {(showAll ? history : history.slice(0, 10)).map((log, index) => (
                <Pressable
                  key={log.date}
                  onPress={() => openDay(log.date)}
                  style={({ pressed }) => [
                    styles.historyRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                    pressed && { backgroundColor: theme.fill },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${relativeDayLabel(log.date, today)}: ${formatNumber(log.totals.calories)} calories, ${log.items.length} items`}
                >
                  <View style={styles.flex}>
                    <AppText variant="callout" weight="600">{relativeDayLabel(log.date, today)}</AppText>
                    <AppText variant="footnote" tone="tertiary">
                      {log.items.length} item{log.items.length === 1 ? '' : 's'} · {formatNumber(log.totals.protein)} g protein
                    </AppText>
                    <ProgressBar
                      progress={goals.calories ? log.totals.calories / goals.calories : 0}
                      color={log.totals.calories > goals.calories * 1.1 ? theme.warning : theme.calories}
                      height={4}
                      style={styles.historyBar}
                    />
                  </View>
                  <AppText variant="callout" weight="600" numeric>{formatNumber(log.totals.calories)} cal</AppText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </Pressable>
              ))}
              {history.length > 10 && (
                <Pressable onPress={() => setShowAll(v => !v)} style={[styles.showAll, { borderTopColor: theme.separator }]} accessibilityRole="button">
                  <AppText variant="subhead" weight="600" tone="brand">{showAll ? 'Show less' : `Show all ${history.length} days`}</AppText>
                </Pressable>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="stats-chart-outline"
                title="No history yet"
                message="Log a few days and you'll see averages, your logging streak and how close you are to your targets."
                actionLabel="Log food"
                onAction={() => router.push('/log')}
                compact
              />
            </Card>
          )}
          <AppText variant="caption" tone="tertiary" align="center" style={styles.inset}>
            Trends use only the days you logged. Logging is a tool for awareness, not a score.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, color, label, value, detail }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileLabel}>
        <Ionicons name={icon} size={15} color={color} />
        <AppText variant="caption" tone="secondary">{label}</AppText>
      </View>
      <AppText variant="title3" numeric>{value}</AppText>
      {detail ? <AppText variant="caption" tone="tertiary">{detail}</AppText> : null}
    </View>
  );
}

function CalorieChart({ logs, goal, today, range, onSelect }: {
  logs: DailyLog[];
  goal: number;
  today: string;
  range: Range;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme();
  const max = Math.max(goal * 1.25, ...logs.map(log => log.totals.calories), 1);
  const goalY = CHART_HEIGHT - (goal / max) * CHART_HEIGHT;
  const narrow = range === 'month';
  return (
    <Animated.View entering={FadeIn.duration(250)} key={range}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        <View style={[styles.goalLine, { top: goalY, borderColor: theme.textTertiary }]} />
        {logs.map(log => {
          const value = log.totals.calories;
          const over = value > goal * 1.1;
          return (
            <Pressable
              key={log.date}
              style={styles.barSlot}
              onPress={() => log.items.length && onSelect(log.date)}
              disabled={!log.items.length}
              accessibilityRole="button"
              accessibilityLabel={`${relativeDayLabel(log.date, today)}: ${log.items.length ? `${formatNumber(value)} calories` : 'nothing logged'}`}
            >
              <Bar
                height={(value / max) * CHART_HEIGHT}
                color={log.items.length ? (over ? theme.warning : theme.calories) : theme.fill}
                width={narrow ? 6 : 22}
                highlight={log.date === today}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {logs.map((log, index) => (
          <View key={log.date} style={styles.barSlot}>
            {(!narrow || index % 5 === 4 || index === logs.length - 1) && (
              <AppText variant="micro" tone={log.date === today ? 'brand' : 'tertiary'} numeric>
                {narrow ? dateFromKey(log.date).getDate() : weekdayInitial(log.date)}
              </AppText>
            )}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function Bar({ height, color, width, highlight }: { height: number; color: string; width: number; highlight: boolean }) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(Math.max(height, 4), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [height, value]);
  const style = useAnimatedStyle(() => ({ height: value.value }));
  return (
    <Animated.View
      style={[
        { width, backgroundColor: color, borderRadius: Math.min(width / 2, 6), opacity: highlight ? 1 : 0.85 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  flex: {
    flex: 1,
  },
  inset: {
    paddingHorizontal: space.xs,
  },
  header: {
    paddingTop: space.md,
    paddingHorizontal: space.xs,
  },
  chartCard: {
    gap: space.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  legendLine: {
    width: 16,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  axis: {
    flexDirection: 'row',
    marginTop: space.sm,
    height: 14,
  },
  statsRow: {
    flexDirection: 'row',
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
  },
  hDivider: {
    height: StyleSheet.hairlineWidth,
  },
  tile: {
    flex: 1,
    gap: 2,
    padding: space.lg,
  },
  tileLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  macroCard: {
    gap: space.md,
  },
  macroBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  history: {
    gap: space.md,
  },
  clip: {
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  historyBar: {
    marginTop: 6,
    maxWidth: 180,
  },
  showAll: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

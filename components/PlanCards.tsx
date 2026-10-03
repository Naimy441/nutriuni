// Weekly budget and meal-plan cards, shared by Today and the Meal plan screen.
import { formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { suggestionTitle } from '@/hooks/usePlanner';
import { dateFromKey, weekdayInitial } from '@/services/dates';
import type { FoodOption, MealTarget, Suggestion, WeekPlan } from '@/services/planner';
import { weekMessage } from '@/services/planner';
import { hasPreferences } from '@/services/dietary';
import { usePreferences } from '@/services/preferences';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { PressableScale, triggerHaptic } from './ui/PressableScale';
import { ProgressBar } from './ui/ProgressBar';

const CHART_HEIGHT = 56;

export function WeekCard({ plan, onPress, title = 'This week' }: { plan: WeekPlan; onPress?: () => void; title?: string }) {
  const theme = useTheme();
  const message = weekMessage(plan);
  const scale = Math.max(...plan.days.map(day => Math.max(day.eaten.calories, day.target)), 1) * 1.05;
  const toneColor = message.tone === 'good' ? theme.success : message.tone === 'warning' ? theme.warning : theme.brandText;
  const icon = message.tone === 'good' ? 'checkmark-circle' : message.tone === 'warning' ? 'alert-circle' : 'swap-vertical';
  return (
    <Card
      onPress={onPress}
      style={styles.week}
      accessibilityLabel={`${title}: ${formatNumber(plan.eaten.calories)} of ${formatNumber(plan.weekly.calories)} calories. ${message.text}`}
    >
      <View style={styles.rowBetween}>
        {/* flex: Android measures this a little narrow in a row and wraps the last word out of sight. */}
        <AppText variant="headline" style={styles.flex}>{title}</AppText>
        {onPress && (
          <View style={styles.link}>
            <AppText variant="subhead" weight="600" tone="brand">Meal plan</AppText>
            <Ionicons name="chevron-forward" size={16} color={theme.brandText} />
          </View>
        )}
      </View>

      <View style={styles.budgets}>
        <Budget label="Calories" value={plan.eaten.calories} total={plan.weekly.calories} unit="" color={theme.calories} />
        <Budget label="Protein" value={plan.eaten.protein} total={plan.weekly.protein} unit=" g" color={theme.protein} />
      </View>

      <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {plan.days.map(day => {
          const future = day.phase === 'future';
          const eatenHeight = (day.eaten.calories / scale) * CHART_HEIGHT;
          const targetHeight = (day.target / scale) * CHART_HEIGHT;
          const over = day.eaten.calories > day.target * 1.1;
          return (
            <View key={day.date} style={styles.dayColumn}>
              <View style={[styles.barArea, { height: CHART_HEIGHT }]}>
                <View style={[styles.targetBar, { height: targetHeight, backgroundColor: theme.fill, borderColor: future ? theme.fillStrong : 'transparent' }]} />
                {!future && day.eaten.calories > 0 && (
                  <View style={[styles.eatenBar, { height: Math.max(eatenHeight, 4), backgroundColor: over ? theme.warning : theme.calories }]} />
                )}
              </View>
              <AppText variant="micro" tone={day.phase === 'today' ? 'brand' : 'tertiary'}>{weekdayInitial(day.date)}</AppText>
              <AppText variant="micro" tone="tertiary" numeric style={styles.dayTarget}>
                {future || day.phase === 'today' ? formatShort(day.target) : day.eaten.calories ? formatShort(day.eaten.calories) : '–'}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={[styles.message, { backgroundColor: message.tone === 'warning' ? theme.warningSoft : theme.fill }]}>
        <Ionicons name={icon} size={16} color={toneColor} />
        <AppText variant="footnote" tone="secondary" style={styles.flex}>{message.text}</AppText>
      </View>
    </Card>
  );
}

function formatShort(calories: number): string {
  return calories >= 1000 ? `${(calories / 1000).toFixed(1)}k` : String(Math.round(calories));
}

function Budget({ label, value, total, unit, color }: { label: string; value: number; total: number; unit: string; color: string }) {
  return (
    <View style={styles.budget}>
      <View style={styles.rowBetween}>
        <AppText variant="caption" tone="secondary">{label}</AppText>
        <AppText variant="caption" numeric>
          <AppText variant="caption" weight="700" numeric>{formatNumber(value)}</AppText>
          <AppText variant="caption" tone="tertiary" numeric> / {formatNumber(total)}{unit}</AppText>
        </AppText>
      </View>
      <ProgressBar progress={total ? value / total : 0} color={color} height={6} />
    </View>
  );
}

const SIZE_TEXT = { lighter: 'Lighter', bigger: 'Bigger', usual: '' } as const;

export function MealPlanCard({
  target, suggestions, onOpen, onLog, loggingKey, footer, showHeader = true, pageSize,
}: {
  showHeader?: boolean; // off where the meal is already shown above the card
  target: MealTarget;
  suggestions: Suggestion[];
  pageSize?: number; // show this many at first, and this many more per tap
  onOpen: (suggestion: Suggestion, part: FoodOption) => void;
  onLog: (suggestion: Suggestion) => void;
  loggingKey?: string | null;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const size = SIZE_TEXT[target.size];
  const { food } = usePreferences();
  const [shown, setShown] = useState(pageSize ?? Infinity);
  const visible = suggestions.slice(0, shown);
  const remaining = suggestions.length - visible.length;
  return (
    <Card padded={false} style={styles.mealCard}>
      {showHeader && (
        <View style={styles.mealHeader}>
          <Ionicons name={target.icon} size={18} color={theme.brandText} />
          <View style={styles.flex}>
            <View style={styles.mealTitleRow}>
              <AppText variant="headline">{target.label}</AppText>
              {target.state === 'planned' && size ? (
                <View style={[styles.sizeTag, { backgroundColor: target.size === 'lighter' ? theme.fill : theme.brandSoft }]}>
                  <AppText variant="micro" tone={target.size === 'lighter' ? 'secondary' : 'brand'}>{size.toUpperCase()}</AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="footnote" tone="secondary" numeric>
              {target.state === 'eaten'
                ? `Eaten · ${formatNumber(target.eaten.calories)} cal · ${formatNumber(target.eaten.protein)} g protein`
                : target.state === 'skipped'
                  ? 'Skipped'
                  : target.state === 'optional'
                    ? 'No room today, and that’s fine'
                    : `About ${formatNumber(target.calories)} cal · ${formatNumber(target.protein)} g protein`}
            </AppText>
          </View>
        </View>
      )}
      {target.state === 'planned' && (
        suggestions.length ? (
          <Animated.View entering={FadeIn.duration(200)}>
            {visible.map((suggestion, index) => (
              <Animated.View key={suggestion.key} entering={index >= (pageSize ?? Infinity) ? FadeIn.duration(200) : undefined}>
                <SuggestionRow
                  divider={showHeader || index > 0}
                  suggestion={suggestion}
                  onOpen={onOpen}
                  onLog={onLog}
                  logging={loggingKey === suggestion.key}
                />
              </Animated.View>
            ))}
            {pageSize && (remaining > 0 || shown > pageSize) ? (
              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  setShown(remaining > 0 ? shown + pageSize : pageSize);
                }}
                style={({ pressed }) => [styles.more, { borderTopColor: theme.separator }, pressed && { backgroundColor: theme.fill }]}
                accessibilityRole="button"
                accessibilityLabel={remaining > 0 ? `Show more ${target.label.toLowerCase()} options, ${remaining} left` : 'Show fewer options'}
              >
                <AppText variant="subhead" weight="600" tone="brand">
                  {remaining > 0 ? `Show ${Math.min(pageSize, remaining)} more` : 'Show fewer'}
                </AppText>
                {remaining > 0 && (
                  <AppText variant="footnote" tone="tertiary" numeric>{remaining} left</AppText>
                )}
                <Ionicons name={remaining > 0 ? 'chevron-down' : 'chevron-up'} size={16} color={theme.brandText} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : (
          <View style={[styles.emptyRow, showHeader && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
            <AppText variant="footnote" tone="tertiary">
              {target.calories < 120
                ? 'You’re about at today’s target — a piece of fruit or nothing at all.'
                : hasPreferences(food)
                  ? 'Nothing open is marked as fitting your diet right now. Your saved meals and Quick add still work.'
                  : 'Nothing open fits right now. Quick add works for anything off-menu.'}
            </AppText>
          </View>
        )
      )}
      {footer}
    </Card>
  );
}

const TAG_PRIORITY: Suggestion['tags'][number][] = ['pick-up-early', 'my-meal', 'favorite', 'check-hours'];

const TAG_TEXT: Record<Suggestion['tags'][number], string> = {
  'high-protein': 'High protein',
  favorite: 'You’ve had this',
  'my-meal': 'Your meal',
  'check-hours': 'Check hours',
  'pick-up-early': 'Pick up the night before',
};

export function SuggestionRow({ suggestion, onOpen, onLog, logging, divider = true }: {
  divider?: boolean;
  suggestion: Suggestion;
  onOpen: (suggestion: Suggestion, part: FoodOption) => void;
  onLog: (suggestion: Suggestion) => void;
  logging?: boolean;
}) {
  const theme = useTheme();
  const places = [...new Set(suggestion.parts.map(part => part.restaurantName))].join(' · ');
  const menuPart = suggestion.parts.find(part => part.source === 'menu');
  // One tag at most; protein is already shown in grams.
  const tag = TAG_PRIORITY.find(t => suggestion.tags.includes(t));
  return (
    <View style={[styles.suggestion, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
      <Pressable
        style={({ pressed }) => [styles.flex, pressed && { opacity: 0.6 }]}
        onPress={() => (menuPart ? onOpen(suggestion, menuPart) : onLog(suggestion))}
        accessibilityRole="button"
        accessibilityLabel={`${suggestionTitle(suggestion)}, ${places}, ${suggestion.calories} calories, ${Math.round(suggestion.protein)} grams protein`}
        accessibilityHint={menuPart ? 'Shows nutrition and options' : 'Adds it to this meal'}
      >
        <AppText variant="callout" weight="600" numberOfLines={2}>{suggestionTitle(suggestion)}</AppText>
        <AppText variant="footnote" tone="tertiary" numberOfLines={1}>{places}</AppText>
        <View style={styles.tagRow}>
          <AppText variant="caption" weight="700" tone="brand" numeric>
            {suggestion.approx ? '~' : ''}{formatNumber(suggestion.calories)} cal
          </AppText>
          <AppText variant="caption" weight="600" color={theme.protein} numeric>{Math.round(suggestion.protein)} g protein</AppText>
          {tag ? <AppText variant="caption" tone="tertiary">· {TAG_TEXT[tag]}</AppText> : null}
        </View>
      </Pressable>
      <PressableScale
        onPress={() => onLog(suggestion)}
        disabled={logging}
        haptic="light"
        scaleTo={0.88}
        hitSlop={6}
        style={[styles.add, { backgroundColor: theme.brandSoft }]}
        accessibilityLabel={`Add ${suggestionTitle(suggestion)}`}
      >
        {logging ? <ActivityIndicator size="small" color={theme.brandText} /> : <Ionicons name="add" size={22} color={theme.brandText} />}
      </PressableScale>
    </View>
  );
}

export function dayChipLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const diff = Math.round((dateFromKey(date).getTime() - dateFromKey(today).getTime()) / 86_400_000);
  if (diff === 1) return 'Tomorrow';
  return dateFromKey(date).toLocaleDateString('en-US', { weekday: 'short' });
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  week: {
    gap: space.md,
  },
  budgets: {
    gap: space.sm,
  },
  budget: {
    gap: 4,
  },
  chart: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.xs,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  targetBar: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  eatenBar: {
    width: 18,
    borderRadius: 5,
  },
  dayTarget: {
    fontWeight: '500',
  },
  message: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
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
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sizeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.sm,
    marginTop: 3,
  },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyRow: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});

// Where a day's protein (or calories, sodium…) came from, item by item.
import { NUTRIENTS, TrackedNutrient, formatAmount } from '@/constants/nutrients';
import { space, useTheme } from '@/constants/theme';
import type { DailyLog } from '@/services/NutritionTracker';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './ui/AppText';
import { IconButton } from './ui/IconButton';
import { ProgressBar } from './ui/ProgressBar';
import { Sheet, SheetRef } from './ui/Sheet';

interface NutrientSheetProps {
  nutrient: TrackedNutrient | null;
  log: DailyLog;
  goal: number;
  onDismiss: () => void;
}

export function NutrientSheet({ nutrient, log, goal, onDismiss }: NutrientSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ref = useRef<SheetRef>(null);
  const [shown, setShown] = useState<TrackedNutrient | null>(nutrient);
  const snapPoints = useMemo(() => ['70%', '92%'], []);

  useEffect(() => {
    if (nutrient) {
      setShown(nutrient);
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [nutrient]);

  const info = shown ? NUTRIENTS[shown] : null;
  const total = shown ? log.totals[shown] : 0;
  const rows = useMemo(() => {
    if (!shown) return [];
    return log.items
      .filter(item => item.nutrition_status !== 'none' && item[shown] > 0)
      .map(item => ({ item, value: item[shown] }))
      .sort((a, b) => b.value - a.value);
  }, [log.items, shown]);

  const color = shown ? theme[shown] : theme.brand;
  const over = info?.kind !== 'target' && goal > 0 && total > goal;
  const summary = !info
    ? ''
    : info.kind === 'budget'
      ? over
        ? `${formatAmount(total - goal, info.unit)} over your target`
        : `${formatAmount(goal - total, info.unit)} left`
      : info.kind === 'limit'
        ? over
          ? `${formatAmount(total - goal, info.unit)} over the daily limit`
          : `${formatAmount(goal - total, info.unit)} under the daily limit`
        : total >= goal
          ? 'Target reached'
          : `${formatAmount(goal - total, info.unit)} to go`;

  return (
    <Sheet ref={ref} snapPoints={snapPoints} enableDynamicSizing={false} onDismiss={onDismiss}>
      {info && (
        <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <AppText variant="title2">{info.label}</AppText>
              <AppText variant="subhead" tone="secondary">{summary}</AppText>
            </View>
            <IconButton icon="close" accessibilityLabel="Close" onPress={() => ref.current?.dismiss()} />
          </View>

          <View style={styles.totalRow}>
            <AppText variant="display" numeric color={color}>{formatAmount(total, info.unit).split(' ')[0]}</AppText>
            <AppText variant="headline" tone="secondary">
              / {formatAmount(goal, info.unit)}
            </AppText>
          </View>
          <ProgressBar progress={goal ? total / goal : 0} color={over ? theme.warning : color} height={10} />

          <AppText variant="footnote" tone="secondary" weight="600" style={styles.sectionLabel}>FROM</AppText>
          {rows.length ? (
            <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              {rows.map(({ item, value }, index) => (
                <View
                  key={item.id}
                  style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
                >
                  <View style={styles.flex}>
                    <AppText variant="callout" weight="600" numberOfLines={1}>{item.name}</AppText>
                    <ProgressBar progress={total ? value / total : 0} color={color} height={4} style={styles.share} />
                  </View>
                  <View style={styles.value}>
                    <AppText variant="callout" weight="600" numeric>{formatAmount(value, info.unit)}</AppText>
                    <AppText variant="caption" tone="tertiary" numeric>{total ? Math.round((value / total) * 100) : 0}%</AppText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="subhead" tone="secondary">Nothing with {info.label.toLowerCase()} logged yet.</AppText>
          )}

          <View style={[styles.about, { backgroundColor: theme.fill }]}>
            <AppText variant="footnote" tone="secondary">{info.about}</AppText>
            <Pressable
              onPress={() => {
                ref.current?.dismiss();
                router.push('/sources');
              }}
              hitSlop={8}
              accessibilityRole="link"
            >
              <AppText variant="footnote" weight="600" tone="brand">Sources & methods</AppText>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  flex: {
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.sm,
  },
  sectionLabel: {
    marginTop: space.md,
    letterSpacing: 0.5,
  },
  list: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  share: {
    marginTop: 6,
  },
  value: {
    alignItems: 'flex-end',
    minWidth: 64,
  },
  about: {
    borderRadius: 14,
    padding: space.md,
    gap: space.xs,
    marginTop: space.sm,
  },
});

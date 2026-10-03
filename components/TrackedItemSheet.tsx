// Details for a logged food: nutrition, which meal it's in, log again, delete.
import { NUTRIENTS, formatAmount } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { relativeDayLabel, timeLabel } from '@/services/dates';
import { sourceLabel } from '@/services/FastAccessService';
import { MealType } from '@/services/meals';
import { currentMealLabel } from '@/services/preferences';
import { formatTrackedCalories, mealOf, nutritionTracker, TrackedItem } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { MealPicker, useMealOptions } from './MealPicker';
import { IconButton } from './ui/IconButton';
import { Sheet, SheetRef } from './ui/Sheet';
import { useToast } from './ui/Toast';

export interface TrackedSelection {
  item: TrackedItem;
  date: string;
}

const STATUS_NOTES: Partial<Record<NonNullable<TrackedItem['nutrition_status']>, { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }>> = {
  estimated: { icon: 'calculator-outline', text: 'Estimated by adding up each part of your order.' },
  partial: { icon: 'alert-circle-outline', text: "Some choices have no nutrition info and aren't counted." },
  manual: { icon: 'create-outline', text: 'Nutrition entered by you.' },
  none: { icon: 'information-circle-outline', text: 'Logged without nutrition. It counts toward your meals but not your totals.' },
};

export function TrackedItemSheet({ selection, onDismiss }: { selection: TrackedSelection | null; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const ref = useRef<SheetRef>(null);
  // Keep showing the item while the sheet animates away after a delete.
  const [shown, setShown] = useState<TrackedSelection | null>(selection);

  useEffect(() => {
    if (selection) {
      setShown(selection);
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [selection]);

  const item = shown?.item;
  const date = shown?.date;
  const meal = item ? mealOf(item) : 'snack';
  const mealOptions = useMealOptions(meal, date);

  const moveTo = async (next: MealType) => {
    if (!item || !date || next === meal) return;
    await nutritionTracker.updateItem(item.id, date, { meal: next });
    setShown({ item: { ...item, meal: next }, date });
  };

  const logAgain = async () => {
    if (!item || !date) return;
    const { id: _id, timestamp: _timestamp, meal: _meal, ...entry } = item;
    const added = await nutritionTracker.addTrackedItem(entry, { date, meal });
    ref.current?.dismiss();
    toast.show({
      message: `Logged ${item.name} again`,
      action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(added.id, date) },
    });
  };

  const remove = async () => {
    if (!item || !date) return;
    await nutritionTracker.removeItem(item.id, date);
    ref.current?.dismiss();
    toast.show({
      message: `Removed ${item.name}`,
      icon: 'trash-outline',
      action: { label: 'Undo', onPress: () => nutritionTracker.restoreItem(item, date) },
    });
  };

  const note = item?.nutrition_status ? STATUS_NOTES[item.nutrition_status] : undefined;
  const hasNutrition = item?.nutrition_status !== 'none';

  return (
    <Sheet ref={ref} onDismiss={onDismiss} enableDynamicSizing>
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
        {item && date ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <AppText variant="title2" numberOfLines={3}>{item.name}</AppText>
                <AppText variant="subhead" tone="secondary" numberOfLines={2}>
                  {[sourceLabel(item.restaurant), item.serving_size].filter(Boolean).join(' · ')}
                </AppText>
                <AppText variant="footnote" tone="tertiary">
                  {relativeDayLabel(date)} · {timeLabel(item.timestamp)}
                </AppText>
              </View>
              <IconButton icon="close" accessibilityLabel="Close" onPress={() => ref.current?.dismiss()} />
            </View>

            {item.details ? (
              <View style={[styles.details, { backgroundColor: theme.fill }]}>
                <Ionicons name="list-outline" size={16} color={theme.textSecondary} />
                <AppText variant="footnote" tone="secondary" style={styles.flex}>{item.details}</AppText>
              </View>
            ) : null}

            <View style={[styles.nutrition, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.caloriesRow}>
                <AppText variant="largeTitle" numeric color={theme.calories}>
                  {hasNutrition ? formatTrackedCalories(item).replace(' cal', '') : '—'}
                </AppText>
                <AppText variant="subhead" tone="secondary">calories</AppText>
              </View>
              {hasNutrition && (
                <View style={styles.grid}>
                  {(['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const).map(key => (
                    <View key={key} style={styles.gridCell}>
                      <View style={styles.gridLabel}>
                        <View style={[styles.dot, { backgroundColor: theme[key] }]} />
                        <AppText variant="caption" tone="secondary">{NUTRIENTS[key].label}</AppText>
                      </View>
                      <AppText variant="headline" numeric>{formatAmount(item[key], NUTRIENTS[key].unit)}</AppText>
                    </View>
                  ))}
                </View>
              )}
              {note && (
                <View style={styles.note}>
                  <Ionicons name={note.icon} size={15} color={theme.textSecondary} />
                  <AppText variant="footnote" tone="secondary" style={styles.flex}>{note.text}</AppText>
                </View>
              )}
            </View>

            {mealOptions.length > 1 && (
              <View style={styles.mealGroup}>
                <AppText variant="footnote" tone="secondary" weight="600" style={styles.sectionLabel}>MEAL</AppText>
                <MealPicker value={meal} onChange={moveTo} date={date} />
              </View>
            )}

            <View style={styles.actions}>
              <Button title="Log again" icon="repeat" variant="tinted" onPress={logAgain} style={styles.flex} accessibilityLabel={`Log ${item.name} again to ${currentMealLabel(meal, date)}`} />
              <Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} style={styles.flex} haptic="medium" />
            </View>
          </>
        ) : null}
      </BottomSheetView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
    gap: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  flex: {
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  nutrition: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.md,
  },
  gridCell: {
    width: '33.33%',
    gap: 2,
  },
  gridLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  note: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  sectionLabel: {
    letterSpacing: 0.5,
  },
  mealGroup: {
    gap: space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: space.md,
  },
});

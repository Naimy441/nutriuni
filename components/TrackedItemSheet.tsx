// Details for a logged food: nutrition, which meal it's in, log again, delete.
import { NUTRIENTS, formatAmount } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { relativeDayLabel, timeLabel } from '@/services/dates';
import { sourceLabel } from '@/services/FastAccessService';
import { MealType } from '@/services/meals';
import { currentMealLabel } from '@/services/preferences';
import { formatTrackedCalories, mealOf, nutritionTracker, TrackedItem } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (selection) {
      setShown(selection);
      setEditing(false);
      setEditError(null);
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

  const startEdit = () => {
    if (!item) return;
    setDraft({
      name: item.name,
      serving_size: item.serving_size,
      calories: String(Math.round(item.calories)),
      protein: String(item.protein),
      carbs: String(item.carbs),
      fat: String(item.fat),
      fiber: String(item.fiber ?? 0),
      sugar: String(item.sugar ?? 0),
      sodium: String(item.sodium ?? 0),
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!item || !date) return;
    const calories = Number(draft.calories);
    if (!draft.name.trim()) {
      setEditError('Name this food');
      return;
    }
    if (!Number.isFinite(calories) || calories < 0 || calories > 10000) {
      setEditError('Enter calories from 0 to 10,000');
      return;
    }
    const read = (key: string) => Math.max(0, Math.round((parseFloat(draft[key]) || 0) * 10) / 10);
    const patch: Partial<TrackedItem> = {
      name: draft.name.trim(),
      serving_size: draft.serving_size.trim() || '1 serving',
      calories: Math.round(calories),
      protein: read('protein'),
      carbs: read('carbs'),
      fat: read('fat'),
      fiber: read('fiber'),
      sugar: read('sugar'),
      sodium: Math.round(read('sodium')),
      nutrition_status: calories === 0 && read('protein') === 0 && read('carbs') === 0 && read('fat') === 0 ? 'none' : 'manual',
    };
    await nutritionTracker.updateItem(item.id, date, patch);
    const next = { ...item, ...patch };
    setShown({ item: next, date });
    setEditing(false);
    toast.show({ message: `Updated ${next.name}` });
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
    <Sheet ref={ref} onDismiss={onDismiss} enableDynamicSizing keyboardBehavior="extend" enablePanDownToClose={!editing}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]} keyboardShouldPersistTaps="handled">
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

            {editing ? (
              <View style={styles.editForm}>
                <EditField label="Name" value={draft.name} onChange={text => setDraft(prev => ({ ...prev, name: text }))} />
                <EditField label="Serving" value={draft.serving_size} onChange={text => setDraft(prev => ({ ...prev, serving_size: text }))} />
                <EditField label="Calories" value={draft.calories} onChange={text => setDraft(prev => ({ ...prev, calories: text.replace(/[^0-9.]/g, '') }))} numeric unit="cal" />
                <View style={styles.editGrid}>
                  {(['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const).map(key => (
                    <View key={key} style={styles.editCell}>
                      <EditField
                        label={NUTRIENTS[key].label}
                        value={draft[key]}
                        onChange={text => setDraft(prev => ({ ...prev, [key]: text.replace(/[^0-9.]/g, '') }))}
                        numeric
                        unit={NUTRIENTS[key].unit}
                      />
                    </View>
                  ))}
                </View>
                {editError ? <AppText variant="footnote" tone="danger">{editError}</AppText> : null}
                <View style={styles.actions}>
                  <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} style={styles.flex} />
                  <Button title="Save" icon="checkmark" onPress={saveEdit} style={styles.flex} haptic="medium" />
                </View>
              </View>
            ) : (
              <>
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
                  <Button title="Edit" icon="create-outline" variant="tinted" onPress={startEdit} style={styles.flex} accessibilityLabel={`Edit ${item.name}`} />
                  <Button title="Log again" icon="repeat" variant="secondary" onPress={logAgain} style={styles.flex} accessibilityLabel={`Log ${item.name} again to ${currentMealLabel(meal, date)}`} />
                </View>
                <Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} haptic="medium" />
              </>
            )}
          </>
        ) : null}
      </BottomSheetScrollView>
    </Sheet>
  );
}

function EditField({ label, value, onChange, numeric, unit }: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  numeric?: boolean;
  unit?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.editField}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <View style={[styles.editInput, { backgroundColor: theme.fill }]}>
        <BottomSheetTextInput
          value={value}
          onChangeText={onChange}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          placeholder="0"
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.brand}
          style={[styles.editText, { color: theme.text }]}
          accessibilityLabel={label}
        />
        {unit ? <AppText variant="footnote" tone="tertiary">{unit}</AppText> : null}
      </View>
    </View>
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
  editForm: {
    gap: space.md,
  },
  editGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  editCell: {
    width: '30%',
    flexGrow: 1,
  },
  editField: {
    gap: 4,
  },
  editInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  editText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: space.sm,
  },
});

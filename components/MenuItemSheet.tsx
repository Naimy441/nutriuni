// Build an order from a dining menu item (choose options, servings, meal) and
// see its nutrition update live before logging it.
import { radius, space, useTheme } from '@/constants/theme';
import { relativeDayLabel } from '@/services/dates';
import { Allergen, allergenLabel, allergenList, dishDietary, DishDietary } from '@/services/dietary';
import { MealType } from '@/services/meals';
import { currentMeal, useMealLabel, usePreferences } from '@/services/preferences';
import { ManualNutrition, trackedEntryFromOrder } from '@/services/menuLogging';
import {
  computeNutrition, defaultSelection, groupMax, hasNutritionSource, isSingleChoice, NutrientKey,
  Selection, selectedCount, setValueQuantity, toggleValue, unmetChoices,
} from '@/services/menuNutrition';
import type { FoodLabel, MenuItem, OptionGroup, OptionValue, RestaurantMenu } from '@/services/menuTypes';
import { nutritionTracker, TrackedItem, useToday } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetFooter, BottomSheetFooterProps, BottomSheetScrollView, BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MealPicker, useMealOptions } from './MealPicker';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { triggerHaptic } from './ui/PressableScale';
import { Sheet, SheetRef } from './ui/Sheet';
import { Stepper } from './ui/Stepper';
import { useToast } from './ui/Toast';

interface MenuItemSheetProps {
  menu: RestaurantMenu | null;
  item: MenuItem | null;
  onClose: () => void;
  onLogged?: (entry: TrackedItem) => void;
  date?: string; // defaults to today
  meal?: MealType; // defaults to the meal for the current time
}

const MANUAL_FIELDS: { key: keyof ManualNutrition; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'cal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

const DETAIL_ROWS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'saturated_fat', label: 'Saturated fat', unit: 'g' },
  { key: 'trans_fat', label: 'Trans fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'fiber', label: 'Dietary fiber', unit: 'g' },
  { key: 'sugar', label: 'Total sugars', unit: 'g' },
  { key: 'added_sugar', label: 'Added sugars', unit: 'g' },
];

const EMPTY_MANUAL: Record<keyof ManualNutrition, string> = {
  calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '',
};

const STALE_DAYS = 120;

function groupHint(group: OptionGroup): string {
  const max = groupMax(group);
  if (group.min >= 1) {
    return group.min === max ? `Required · choose ${group.min}` : `Required · choose ${group.min}${Number.isFinite(max) ? `–${max}` : '+'}`;
  }
  return Number.isFinite(max) && max < group.values.length ? `Optional · up to ${max}` : 'Optional';
}

function valueEffect(value: OptionValue, foods: Record<string, FoodLabel>, quantity: number): string {
  const label = value.food ? foods[value.food] : undefined;
  if (!label) return '';
  const calories = Math.round(label.calories * (value.quantity ?? 1) * Math.max(quantity, 1));
  if (value.kind === 'add') return `+${calories} cal`;
  if (value.kind === 'remove') return `−${calories} cal`;
  return '';
}

function monthYear(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function MenuItemSheet({ menu, item, onClose, onLogged, date, meal: initialMeal }: MenuItemSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const today = useToday();
  const sheetRef = useRef<SheetRef>(null);
  const snapPoints = useMemo(() => ['92%'], []);

  const [selection, setSelection] = useState<Selection>([]);
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState<MealType>(initialMeal ?? currentMeal());
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (item && menu) {
      setSelection(defaultSelection(item));
      setServings(1);
      setMeal(initialMeal ?? currentMeal());
      setShowBreakdown(false);
      setManualMode(false);
      setManual(EMPTY_MANUAL);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
    // A new item resets the order; the meal follows the latest prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, menu]);

  const result = useMemo(
    () => (item && menu && selection.length === (item.options?.length ?? 0) ? computeNutrition(menu, item, selection, servings) : null),
    [menu, item, selection, servings],
  );
  const unmet = useMemo(() => (item ? unmetChoices(item, selection) : []), [item, selection]);
  const { food } = usePreferences();
  const dietary = useMemo(
    () => (item && menu && selection.length === (item.options?.length ?? 0) ? dishDietary(menu, item, selection) : null),
    [menu, item, selection],
  );
  const conflicts = dietary ? dietary.contains.filter(code => food.avoid.includes(code)) : [];
  const possible = dietary ? dietary.mayContain.filter(code => food.avoid.includes(code)) : [];

  const manualValues = useMemo((): ManualNutrition | null => {
    const calories = parseFloat(manual.calories);
    if (!manualMode || !Number.isFinite(calories) || calories <= 0) return null;
    const read = (key: keyof ManualNutrition) => Math.max(0, parseFloat(manual[key]) || 0);
    return {
      calories: Math.round(calories), protein: read('protein'), carbs: read('carbs'), fat: read('fat'),
      fiber: read('fiber'), sugar: read('sugar'), sodium: Math.round(read('sodium')),
    };
  }, [manual, manualMode]);

  const logDate = date ?? today;
  const labelOf = useMealLabel(logDate);
  const mealOptions = useMealOptions(meal, logDate);

  const logOrder = async (withoutNutrition = false) => {
    if (!item || !menu || isLogging) return;
    setIsLogging(true);
    try {
      const entry = trackedEntryFromOrder(menu, item, selection, servings, withoutNutrition ? undefined : manualValues ?? undefined);
      const tracked = await nutritionTracker.addTrackedItem(entry, { date: logDate, meal });
      sheetRef.current?.dismiss();
      toast.show({
        message: `Added ${item.name} to ${labelOf(meal)}${logDate !== today ? ` · ${relativeDayLabel(logDate, today)}` : ''}`,
        action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(tracked.id, logDate) },
      });
      onLogged?.(tracked);
    } catch {
      toast.show({ message: "Couldn't save that. Please try again.", tone: 'error' });
    } finally {
      setIsLogging(false);
    }
  };

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (!item || !menu) return null;
      let label: string;
      let disabled = false;
      let onPress = () => logOrder();
      if (manualMode) {
        label = manualValues ? `Add · ${Math.round(manualValues.calories * servings).toLocaleString()} cal` : 'Enter calories to add';
        disabled = !manualValues;
      } else if (unmet.length && hasNutritionSource(item)) {
        label = `Choose ${unmet[0].name}`;
        disabled = true;
      } else if (result?.totals) {
        label = `Add to ${labelOf(meal)} · ${result.estimated || result.status === 'partial' ? '~' : ''}${result.totals.calories.toLocaleString()} cal`;
      } else {
        label = 'Add without nutrition';
        onPress = () => logOrder(true);
      }
      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, space.md),
                backgroundColor: theme.scheme === 'dark' ? theme.surface : theme.background,
                borderTopColor: theme.separator,
              },
            ]}
          >
            <Button title={label} icon="add-circle" onPress={onPress} disabled={disabled} loading={isLogging} haptic="medium" fullWidth />
          </View>
        </BottomSheetFooter>
      );
    },
    // logOrder closes over the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, menu, manualMode, manualValues, unmet, result, isLogging, theme, insets.bottom, selection, servings, meal, logDate],
  );

  const foods = menu?.foods ?? {};
  const lastSeen = result?.parts.map(p => p.label.last_seen).filter(Boolean).sort()[0];
  const stale = lastSeen ? Date.now() - new Date(`${lastSeen}T12:00:00`).getTime() > STALE_DAYS * 86_400_000 : false;

  const renderNutrition = () => {
    if (!item) return null;
    if (manualMode) {
      return (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <View style={styles.rowBetween}>
            <AppText variant="headline">Your estimate</AppText>
            <Pressable onPress={() => setManualMode(false)} hitSlop={10} accessibilityRole="button">
              <AppText variant="subhead" weight="600" tone="brand">Cancel</AppText>
            </Pressable>
          </View>
          <AppText variant="footnote" tone="secondary">Per serving. Only calories are required.</AppText>
          <View style={styles.manualGrid}>
            {MANUAL_FIELDS.map(field => (
              <View key={field.key} style={styles.manualField}>
                <AppText variant="caption" tone="secondary">{field.label}</AppText>
                <View style={[styles.manualInputRow, { backgroundColor: theme.fill }]}>
                  <BottomSheetTextInput
                    style={[styles.manualInput, { color: theme.text }]}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.textTertiary}
                    selectionColor={theme.brand}
                    value={manual[field.key]}
                    onChangeText={text => setManual(prev => ({ ...prev, [field.key]: text.replace(/[^0-9.]/g, '') }))}
                    accessibilityLabel={`${field.label} in ${field.unit}`}
                  />
                  <AppText variant="footnote" tone="tertiary">{field.unit}</AppText>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (!result?.totals) {
      if (hasNutritionSource(item)) {
        return (
          <View style={[styles.card, styles.infoRow, { backgroundColor: theme.brandSoft, borderColor: 'transparent' }]}>
            <Ionicons name="options-outline" size={22} color={theme.brandText} />
            <AppText variant="subhead" style={styles.flex}>Choose options below to see nutrition for your order.</AppText>
          </View>
        );
      }
      return (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={22} color={theme.textSecondary} />
            <AppText variant="subhead" tone="secondary" style={styles.flex}>
              {"Duke hasn't published nutrition for this item. Enter your own estimate, or add it without nutrition."}
            </AppText>
          </View>
          <Button title="Enter nutrition" icon="create-outline" variant="tinted" size="md" onPress={() => setManualMode(true)} />
        </View>
      );
    }

    const totals = result.totals;
    const approx = result.estimated || result.status === 'partial';
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <View style={styles.caloriesRow}>
          <View>
            <View style={styles.caloriesValue}>
              {approx && <AppText variant="display" color={theme.calories}>~</AppText>}
              <AnimatedNumber value={totals.calories} variant="display" color={theme.calories} duration={350} />
            </View>
            <AppText variant="footnote" tone="secondary">calories{servings !== 1 ? ` · ${servings} servings` : ''}</AppText>
          </View>
          <View style={styles.macroColumn}>
            {(['protein', 'carbs', 'fat'] as const).map(key => (
              <View key={key} style={styles.macroRow}>
                <View style={[styles.dot, { backgroundColor: theme[key] }]} />
                <AppText variant="subhead" tone="secondary" style={styles.flex}>
                  {key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat'}
                </AppText>
                <AppText variant="subhead" weight="700" numeric>{totals[key]} g</AppText>
              </View>
            ))}
          </View>
        </View>

        {result.status === 'partial' && (
          <Note icon="alert-circle-outline" color={theme.warning}>Not counted (no label): {result.missing.join(', ')}</Note>
        )}
        {result.estimated && (
          <Note icon="calculator-outline" color={theme.brandText}>
            Estimated by adding up {result.parts.length} NetNutrition label{result.parts.length === 1 ? '' : 's'}
          </Note>
        )}
        {stale && lastSeen && (
          <Note icon="time-outline" color={theme.warning}>Some labels were last published in {monthYear(lastSeen)}</Note>
        )}

        <Pressable
          style={styles.breakdownToggle}
          onPress={() => {
            triggerHaptic('selection');
            setShowBreakdown(v => !v);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: showBreakdown }}
        >
          <AppText variant="subhead" weight="600" tone="brand">{showBreakdown ? 'Hide details' : 'Full nutrition'}</AppText>
          <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={theme.brandText} />
        </Pressable>
        {showBreakdown && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.breakdown}>
            {result.base && !item.components?.length && (
              <AppText variant="footnote" tone="tertiary" style={styles.labelLine}>
                NetNutrition label: {result.base.name}{result.base.serving_size ? ` · ${result.base.serving_size}` : ''}
              </AppText>
            )}
            {result.parts.length > 1 && (
              <View style={[styles.breakdownBlock, { borderBottomColor: theme.separator }]}>
                {result.parts.map((part, index) => (
                  <View key={`${part.name}-${index}`} style={styles.detailRow}>
                    <AppText variant="footnote" tone="secondary" numberOfLines={1} style={styles.flex}>
                      {part.sign < 0 ? part.name : part.label.name}{part.quantity !== 1 ? ` ×${part.quantity}` : ''}
                    </AppText>
                    <AppText variant="footnote" weight="600" numeric>
                      {part.sign < 0 ? '−' : ''}{Math.round(part.label.calories * part.quantity * servings)} cal
                    </AppText>
                  </View>
                ))}
              </View>
            )}
            {DETAIL_ROWS.map(row => (
              <View key={row.key} style={styles.detailRow}>
                <AppText variant="footnote" tone="secondary" style={styles.flex}>{row.label}</AppText>
                <AppText variant="footnote" weight="600" numeric>{totals[row.key]} {row.unit}</AppText>
              </View>
            ))}
          </Animated.View>
        )}
      </View>
    );
  };

  const renderValue = (group: OptionGroup, g: number, value: OptionValue, v: number) => {
    if (!item) return null;
    const quantity = selection[g]?.[v] ?? 0;
    const selected = quantity > 0;
    const single = isSingleChoice(group);
    const showStepper = selected && group.allow_quantity && groupMax(group) > 1;
    const effect = valueEffect(value, foods, quantity);
    const halal = value.food ? foods[value.food]?.halal : false;
    const valueConflicts = (value.kind === 'add' && value.food ? foods[value.food]?.contains ?? [] : [])
      .filter(code => food.avoid.includes(code as Allergen));
    return (
      <Pressable
        key={`${value.name}-${v}`}
        style={[
          styles.valueRow,
          { borderColor: selected ? theme.brand : theme.separator, backgroundColor: selected ? theme.brandSoft : theme.surface },
        ]}
        onPress={() => {
          triggerHaptic('selection');
          setSelection(prev => toggleValue(item, prev, g, v));
        }}
        accessibilityRole={single ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={[value.name, effect, value.price ? `${value.price.toFixed(2)} dollars` : ''].filter(Boolean).join(', ')}
      >
        <Ionicons
          name={single ? (selected ? 'radio-button-on' : 'radio-button-off') : (selected ? 'checkbox' : 'square-outline')}
          size={22}
          color={selected ? theme.brand : theme.textTertiary}
        />
        <View style={styles.flex}>
          <View style={styles.valueNameRow}>
            <AppText variant="callout" style={styles.shrink}>{value.name}</AppText>
            {halal && <HalalTag />}
          </View>
          {(effect || value.price) ? (
            <AppText variant="caption" tone="tertiary">
              {[effect, value.price ? `+$${value.price.toFixed(2)}` : ''].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
          {valueConflicts.length > 0 && (
            <AppText variant="caption" weight="600" tone="danger">Contains {allergenList(valueConflicts)}</AppText>
          )}
        </View>
        {showStepper && (
          <View style={styles.stepper}>
            <IconButton
              icon="remove"
              size={28}
              variant="plain"
              accessibilityLabel={`Fewer ${value.name}`}
              onPress={() => setSelection(prev => setValueQuantity(item, prev, g, v, quantity - 1))}
            />
            <AppText variant="headline" numeric style={styles.stepperValue}>{quantity}</AppText>
            <IconButton
              icon="add"
              size={28}
              variant="plain"
              accessibilityLabel={`More ${value.name}`}
              onPress={() => setSelection(prev => setValueQuantity(item, prev, g, v, quantity + 1))}
            />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Sheet
      ref={sheetRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enableDynamicSizing={false}
      footerComponent={renderFooter}
    >
      {item && menu ? (
        <>
          <View style={[styles.header, { borderBottomColor: theme.separator }]}>
            <View style={styles.flex}>
              <AppText variant="title2" numberOfLines={3}>{item.name}</AppText>
              <View style={styles.headerMeta}>
                <AppText variant="subhead" tone="secondary">{menu.name}</AppText>
                {item.price !== undefined && <AppText variant="subhead" tone="secondary">· ${item.price.toFixed(2)}</AppText>}
                {item.halal && <HalalTag filled />}
              </View>
            </View>
            <IconButton icon="close" accessibilityLabel="Close" onPress={() => sheetRef.current?.dismiss()} />
          </View>

          <BottomSheetScrollView
            contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
          >
            {item.description ? <AppText variant="subhead" tone="secondary">{item.description}</AppText> : null}

            {(conflicts.length > 0 || possible.length > 0) && (
              <View style={[styles.warning, { backgroundColor: conflicts.length ? theme.dangerSoft : theme.warningSoft }]}>
                <Ionicons name="warning" size={18} color={conflicts.length ? theme.danger : theme.warning} />
                <AppText variant="subhead" weight="600" tone={conflicts.length ? 'danger' : 'warning'} style={styles.flex}>
                  {conflicts.length
                    ? `Contains ${allergenList(conflicts)}, which you avoid.`
                    : `May contain ${allergenList(possible)}, going by its name. Check with staff.`}
                </AppText>
              </View>
            )}

            {renderNutrition()}

            {dietary?.known && <DietarySummary dietary={dietary} avoid={food.avoid} />}

            {(item.options ?? []).map((group, g) => {
              const missingChoice = selectedCount(selection, g) < group.min;
              return (
                <View key={`${group.name}-${g}`} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <AppText variant="headline" accessibilityRole="header">{group.name}</AppText>
                    <AppText variant="footnote" weight={missingChoice ? '600' : '400'} tone={missingChoice ? 'warning' : 'tertiary'}>
                      {groupHint(group)}
                    </AppText>
                  </View>
                  {group.values.map((value, v) => renderValue(group, g, value, v))}
                </View>
              );
            })}

            <View style={[styles.settingRow, { borderTopColor: theme.separator }]}>
              <View style={styles.flex}>
                <AppText variant="headline">Servings</AppText>
                <AppText variant="footnote" tone="tertiary">Ate half? Shared it? Adjust here.</AppText>
              </View>
              <Stepper value={servings} onChange={setServings} min={0.5} max={10} step={0.5} label="servings" />
            </View>

            {(mealOptions.length > 1 || logDate !== today) && (
              <View style={styles.group}>
                <View style={styles.groupHeader}>
                  <AppText variant="headline">Add to</AppText>
                  {logDate !== today && (
                    <AppText variant="footnote" tone="tertiary">{relativeDayLabel(logDate, today)}</AppText>
                  )}
                </View>
                <MealPicker value={meal} onChange={setMeal} date={logDate} />
              </View>
            )}

            {result?.totals && !manualMode && (
              <Pressable style={styles.inlineLink} onPress={() => setManualMode(true)} hitSlop={8} accessibilityRole="button">
                <AppText variant="footnote" tone="secondary" style={styles.underline}>Numbers look off? Enter your own</AppText>
              </Pressable>
            )}

            <AppText variant="caption" tone="tertiary" align="center">
              {menu.nutrition_sources.length
                ? 'Nutrition from Duke NetNutrition labels, matched to each dish and option. Estimates, not medical advice.'
                : 'Menu from Duke dining. Estimates, not medical advice.'}
            </AppText>
          </BottomSheetScrollView>
        </>
      ) : null}
    </Sheet>
  );
}

// What the labels say: diet marks and allergens, for the order as built.
function DietarySummary({ dietary, avoid }: { dietary: DishDietary; avoid: Allergen[] }) {
  const theme = useTheme();
  const marks = [dietary.vegan ? 'Vegan' : dietary.vegetarian ? 'Vegetarian' : null, dietary.halalCertified ? 'Halal' : null]
    .filter(Boolean) as string[];
  return (
    <View style={styles.dietary}>
      {marks.length > 0 && (
        <View style={styles.marks}>
          {marks.map(mark => (
            <View key={mark} style={[styles.markPill, { backgroundColor: theme.brandSoft }]}>
              <Ionicons name={mark === 'Halal' ? 'checkmark-circle' : 'leaf'} size={13} color={theme.brandText} />
              <AppText variant="caption" weight="700" tone="brand">{mark}</AppText>
            </View>
          ))}
        </View>
      )}
      <AppText variant="footnote" tone="secondary">
        {!dietary.allergenInfo
          ? 'This kitchen doesn’t publish allergen info. Ask staff.'
          : dietary.contains.length
            ? (
              <>
                Contains{' '}
                {dietary.contains.map((code, index) => (
                  <AppText
                    key={code}
                    variant="footnote"
                    weight={avoid.includes(code) ? '700' : '400'}
                    color={avoid.includes(code) ? theme.danger : theme.textSecondary}
                  >
                    {allergenLabel(code).toLowerCase()}{index < dietary.contains.length - 2 ? ', ' : index === dietary.contains.length - 2 ? ' and ' : ''}
                  </AppText>
                ))}
                .
              </>
            )
            : 'No allergens marked on its label.'}
        {dietary.allergenInfo && dietary.mayContain.length > 0
          ? ` Its name suggests ${allergenList(dietary.mayContain)}${dietary.contains.length ? ' too' : ''}.`
          : ''}
      </AppText>
    </View>
  );
}

function Note({ icon, color, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <Ionicons name={icon} size={16} color={color} />
      <AppText variant="footnote" tone="secondary" style={styles.flex}>{children}</AppText>
    </View>
  );
}

export function HalalTag({ filled }: { filled?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.halal,
        filled ? { backgroundColor: theme.brand } : { borderColor: theme.brand, borderWidth: 1 },
      ]}
      accessibilityLabel="Halal"
    >
      <AppText variant="micro" color={filled ? theme.onBrand : theme.brandText}>HALAL</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  dietary: {
    gap: space.sm,
    marginTop: -space.sm,
  },
  marks: {
    flexDirection: 'row',
    gap: space.sm,
  },
  markPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  caloriesValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroColumn: {
    gap: 4,
    width: 140,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  breakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  labelLine: {
    marginBottom: space.xs,
  },
  breakdown: {
    gap: 2,
  },
  breakdownBlock: {
    paddingBottom: space.sm,
    marginBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 3,
  },
  group: {
    gap: space.sm,
  },
  groupHeader: {
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  valueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperValue: {
    minWidth: 20,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
  },
  inlineLink: {
    alignSelf: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  manualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.md,
  },
  manualField: {
    width: '48%',
    gap: 4,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.md,
  },
  manualInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 10,
  },
  halal: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

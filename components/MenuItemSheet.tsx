import { Citations } from '@/components/Citations';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ManualNutrition, trackedEntryFromOrder } from '@/services/menuLogging';
import {
  computeNutrition, defaultSelection, groupMax, hasNutritionSource, isSingleChoice, NutrientKey,
  Selection, selectedCount, setValueQuantity, toggleValue, unmetChoices,
} from '@/services/menuNutrition';
import type { FoodLabel, MenuItem, OptionGroup, OptionValue, RestaurantMenu } from '@/services/menuTypes';
import { TrackedItem, useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetFooter, BottomSheetFooterProps, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './ThemedText';

interface MenuItemSheetProps {
  menu: RestaurantMenu | null;
  item: MenuItem | null;
  onClose: () => void;
  onLogged?: (entry: TrackedItem) => void;
}

const MANUAL_FIELDS: { key: keyof ManualNutrition; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

const DETAIL_ROWS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'saturated_fat', label: 'Saturated Fat', unit: 'g' },
  { key: 'trans_fat', label: 'Trans Fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'fiber', label: 'Dietary Fiber', unit: 'g' },
  { key: 'sugar', label: 'Total Sugars', unit: 'g' },
  { key: 'added_sugar', label: 'Added Sugars', unit: 'g' },
];

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
  const calories = label.calories * (value.quantity ?? 1) * Math.max(quantity, 1);
  if (value.kind === 'add') return `+${calories} cal`;
  if (value.kind === 'remove') return `−${calories} cal`;
  return '';
}

function monthYear(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function MenuItemSheet({ menu, item, onClose, onLogged }: MenuItemSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { addItem } = useNutritionTracker();
  const snapPoints = useMemo(() => ['92%'], []);

  const [selection, setSelection] = useState<Selection>([]);
  const [servings, setServings] = useState(1);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<Record<keyof ManualNutrition, string>>({
    calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '',
  });
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (item && menu) {
      setSelection(defaultSelection(item));
      setServings(1);
      setShowBreakdown(false);
      setManualMode(false);
      setManual({ calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '' });
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [item, menu]);

  const handleChange = useCallback((index: number) => {
    if (index === -1) onClose();
  }, [onClose]);

  const result = useMemo(
    () => (item && menu && selection.length === (item.options?.length ?? 0) ? computeNutrition(menu, item, selection, servings) : null),
    [menu, item, selection, servings],
  );
  const unmet = useMemo(() => (item ? unmetChoices(item, selection) : []), [item, selection]);

  const manualValues = useMemo((): ManualNutrition | null => {
    const calories = parseFloat(manual.calories);
    if (!manualMode || !Number.isFinite(calories) || calories <= 0) return null;
    const read = (key: keyof ManualNutrition) => Math.max(0, parseFloat(manual[key]) || 0);
    return {
      calories: Math.round(calories), protein: read('protein'), carbs: read('carbs'), fat: read('fat'),
      fiber: read('fiber'), sugar: read('sugar'), sodium: Math.round(read('sodium')),
    };
  }, [manual, manualMode]);

  const logOrder = async (withoutNutrition = false) => {
    if (!item || !menu) return;
    setIsLogging(true);
    try {
      const entry = trackedEntryFromOrder(menu, item, selection, servings, withoutNutrition ? undefined : manualValues ?? undefined);
      const tracked = await addItem(entry);
      sheetRef.current?.dismiss();
      onLogged?.(tracked);
    } catch (error) {
      console.error('Error logging item:', error);
      Alert.alert('Error', 'Failed to add this item to your log. Please try again.');
    } finally {
      setIsLogging(false);
    }
  };

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (!item || !menu) return null;
      let label: string;
      let disabled = isLogging;
      let onPress = () => logOrder();
      if (manualMode) {
        label = manualValues ? `Log · ${Math.round(manualValues.calories * servings).toLocaleString()} cal` : 'Enter calories to log';
        disabled = disabled || !manualValues;
      } else if (unmet.length && hasNutritionSource(item)) {
        label = `Choose ${unmet[0].name}`;
        disabled = true;
      } else if (result?.totals) {
        label = `Log · ${result.estimated || result.status === 'partial' ? '~' : ''}${result.totals.calories.toLocaleString()} cal`;
      } else {
        label = 'Log without nutrition';
        onPress = () => logOrder(true);
      }
      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <TouchableOpacity
              style={[styles.logButton, disabled && styles.logButtonDisabled]}
              onPress={onPress}
              disabled={disabled}
              accessibilityRole="button"
            >
              <Ionicons name={isLogging ? 'hourglass' : 'add-circle'} size={22} color="#FFFFFF" />
              <ThemedText style={styles.logButtonText}>{isLogging ? 'Adding…' : label}</ThemedText>
            </TouchableOpacity>
          </View>
        </BottomSheetFooter>
      );
    },
    // logOrder closes over the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, menu, manualMode, manualValues, unmet, result, isLogging, isDark, insets.bottom, selection, servings],
  );

  if (!item || !menu) return null;

  const foods = menu.foods;
  const subtle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const needsChoice = !result?.totals && hasNutritionSource(item);
  const lastSeen = result?.parts.map(p => p.label.last_seen).sort()[0];
  const stale = lastSeen && Date.now() - new Date(`${lastSeen}T00:00:00`).getTime() > STALE_DAYS * 86_400_000;

  const renderNutritionCard = () => {
    if (manualMode) {
      return (
        <View style={[styles.card, { backgroundColor: subtle }]}>
          <View style={styles.cardHeaderRow}>
            <ThemedText style={styles.cardTitle}>Your nutrition estimate</ThemedText>
            <TouchableOpacity onPress={() => setManualMode(false)}>
              <ThemedText style={styles.link}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.muted}>Per serving. Only calories are required.</ThemedText>
          <View style={styles.manualGrid}>
            {MANUAL_FIELDS.map(field => (
              <View key={field.key} style={styles.manualField}>
                <ThemedText style={styles.manualLabel}>{field.label}</ThemedText>
                <View style={[styles.manualInputRow, { borderColor: border }]}>
                  <BottomSheetTextInput
                    style={[styles.manualInput, { color: isDark ? '#fff' : '#000' }]}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                    value={manual[field.key]}
                    onChangeText={text => setManual(prev => ({ ...prev, [field.key]: text.replace(/[^0-9.]/g, '') }))}
                    accessibilityLabel={`${field.label} in ${field.unit}`}
                  />
                  <ThemedText style={styles.manualUnit}>{field.unit}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (!result?.totals) {
      if (needsChoice) {
        return (
          <View style={[styles.card, styles.infoCard, { backgroundColor: subtle }]}>
            <Ionicons name="options-outline" size={22} color={Colors.primary} />
            <ThemedText style={styles.infoText}>Choose options below to see nutrition for your order.</ThemedText>
          </View>
        );
      }
      return (
        <View style={[styles.card, { backgroundColor: subtle }]}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={22} color={isDark ? '#bbb' : '#666'} />
            <ThemedText style={styles.infoText}>
              {"Duke hasn't published nutrition for this item. You can enter your own estimate or log it without nutrition."}
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setManualMode(true)}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <ThemedText style={styles.secondaryButtonText}>Enter nutrition</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const totals = result.totals;
    return (
      <View style={[styles.card, styles.nutritionCard]}>
        <View style={styles.caloriesRow}>
          <View>
            <ThemedText style={styles.caloriesValue}>
              {result.estimated || result.status === 'partial' ? '~' : ''}{totals.calories.toLocaleString()}
            </ThemedText>
            <ThemedText style={styles.caloriesUnit}>calories{servings !== 1 ? ` · ${servings} servings` : ''}</ThemedText>
          </View>
          <View style={styles.macroColumn}>
            {([['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([name, value]) => (
              <View key={name} style={styles.macroRow}>
                <ThemedText style={styles.macroLabel}>{name}</ThemedText>
                <ThemedText style={styles.macroValue}>{value}g</ThemedText>
              </View>
            ))}
          </View>
        </View>

        {result.status === 'partial' && (
          <View style={styles.noteRow}>
            <Ionicons name="alert-circle-outline" size={16} color="#B7791F" />
            <ThemedText style={styles.noteText}>Not counted (no label): {result.missing.join(', ')}</ThemedText>
          </View>
        )}
        {result.estimated && (
          <View style={styles.noteRow}>
            <Ionicons name="calculator-outline" size={16} color={Colors.primary} />
            <ThemedText style={styles.noteText}>
              Estimated by adding up {result.parts.length} NetNutrition label{result.parts.length === 1 ? '' : 's'}
            </ThemedText>
          </View>
        )}
        {result.base && !item.components?.length && (
          <View style={styles.noteRow}>
            <Ionicons name="restaurant-outline" size={16} color={Colors.primary} />
            <ThemedText style={styles.noteText}>
              Label: {result.base.name}{result.base.serving_size ? ` · ${result.base.serving_size}` : ''}
            </ThemedText>
          </View>
        )}
        {stale && (
          <View style={styles.noteRow}>
            <Ionicons name="time-outline" size={16} color="#B7791F" />
            <ThemedText style={styles.noteText}>Some labels were last published in {monthYear(lastSeen!)}</ThemedText>
          </View>
        )}

        <TouchableOpacity style={styles.breakdownToggle} onPress={() => setShowBreakdown(v => !v)}>
          <ThemedText style={styles.link}>{showBreakdown ? 'Hide details' : 'Nutrition details'}</ThemedText>
          <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
        </TouchableOpacity>
        {showBreakdown && (
          <View style={styles.breakdown}>
            {result.parts.length > 1 && (
              <View style={styles.breakdownBlock}>
                {result.parts.map((part, index) => (
                  <View key={`${part.name}-${index}`} style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel} numberOfLines={1}>
                      {part.sign < 0 ? part.name : part.label.name}{part.quantity !== 1 ? ` ×${part.quantity}` : ''}
                    </ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {part.sign < 0 ? '−' : ''}{Math.round(part.label.calories * part.quantity * servings)} cal
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
            {DETAIL_ROWS.map(row => (
              <View key={row.key} style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{row.label}</ThemedText>
                <ThemedText style={styles.detailValue}>{totals[row.key]}{row.unit}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderValue = (group: OptionGroup, g: number, value: OptionValue, v: number) => {
    const quantity = selection[g]?.[v] ?? 0;
    const selected = quantity > 0;
    const single = isSingleChoice(group);
    const showStepper = selected && group.allow_quantity && groupMax(group) > 1;
    const effect = valueEffect(value, foods, quantity);
    const halal = value.food ? foods[value.food]?.halal : false;
    return (
      <TouchableOpacity
        key={`${value.name}-${v}`}
        style={[styles.valueRow, { borderColor: border }, selected && styles.valueRowSelected]}
        onPress={() => setSelection(prev => toggleValue(item, prev, g, v))}
        accessibilityRole={single ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: selected }}
      >
        <Ionicons
          name={single ? (selected ? 'radio-button-on' : 'radio-button-off') : (selected ? 'checkbox' : 'square-outline')}
          size={22}
          color={selected ? Colors.primary : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
        />
        <View style={styles.valueText}>
          <View style={styles.valueNameRow}>
            <ThemedText style={styles.valueName}>{value.name}</ThemedText>
            {halal && <ThemedText style={styles.halalMini}>Halal</ThemedText>}
          </View>
          {(effect || value.price) ? (
            <ThemedText style={styles.valueMeta}>
              {[effect, value.price ? `+$${value.price.toFixed(2)}` : ''].filter(Boolean).join(' · ')}
            </ThemedText>
          ) : null}
        </View>
        {showStepper && (
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => setSelection(prev => setValueQuantity(item, prev, g, v, quantity - 1))}
              hitSlop={8}
              accessibilityLabel={`Fewer ${value.name}`}
            >
              <Ionicons name="remove-circle-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.stepperValue}>{quantity}</ThemedText>
            <TouchableOpacity
              onPress={() => setSelection(prev => setValueQuantity(item, prev, g, v, quantity + 1))}
              hitSlop={8}
              accessibilityLabel={`More ${value.name}`}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onChange={handleChange}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      footerComponent={renderFooter}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[styles.sheetBackground, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}
      handleIndicatorStyle={{ backgroundColor: isDark ? '#666' : '#ccc', width: 40 }}
    >
      <View style={[styles.header, { borderBottomColor: border }]}>
        <View style={styles.headerText}>
          <ThemedText style={styles.title} numberOfLines={2}>{item.name}</ThemedText>
          <View style={styles.headerMeta}>
            <ThemedText style={styles.muted}>{menu.name}</ThemedText>
            {item.price !== undefined && <ThemedText style={styles.muted}>· ${item.price.toFixed(2)}</ThemedText>}
            {item.halal && (
              <View style={styles.halalBadge}>
                <ThemedText style={styles.halalText}>Halal</ThemedText>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => sheetRef.current?.dismiss()} style={styles.closeButton} accessibilityLabel="Close">
          <Ionicons name="close" size={18} color={isDark ? '#ddd' : '#333'} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
        {item.description ? <ThemedText style={styles.description}>{item.description}</ThemedText> : null}

        {renderNutritionCard()}

        {(item.options ?? []).map((group, g) => {
          const count = selectedCount(selection, g);
          const missingChoice = count < group.min;
          return (
            <View key={`${group.name}-${g}`} style={styles.group}>
              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}>{group.name}</ThemedText>
                <ThemedText style={[styles.groupHint, missingChoice && styles.groupHintRequired]}>{groupHint(group)}</ThemedText>
              </View>
              {group.values.map((value, v) => renderValue(group, g, value, v))}
            </View>
          );
        })}

        <View style={[styles.servingsRow, { borderColor: border }]}>
          <View>
            <ThemedText style={styles.groupTitle}>Servings</ThemedText>
            <ThemedText style={styles.groupHint}>Ate half? Shared it? Adjust here.</ThemedText>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => setServings(s => Math.max(0.5, s - 0.5))} hitSlop={8} accessibilityLabel="Fewer servings">
              <Ionicons name="remove-circle-outline" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.servingsValue}>{servings}</ThemedText>
            <TouchableOpacity onPress={() => setServings(s => Math.min(10, s + 0.5))} hitSlop={8} accessibilityLabel="More servings">
              <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {result?.totals && !manualMode && (
          <TouchableOpacity style={styles.inlineLink} onPress={() => setManualMode(true)}>
            <ThemedText style={styles.linkMuted}>Numbers look off? Enter your own</ThemedText>
          </TouchableOpacity>
        )}

        <Citations type="all" style={styles.citations} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.65,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(128,128,128,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
  },
  halalText: {
    fontSize: 11,
    lineHeight: 16,
    color: 'white',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
    marginBottom: 14,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  nutritionCard: {
    backgroundColor: 'rgba(0, 104, 56, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.35)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  secondaryButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caloriesValue: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    color: Colors.primary,
  },
  caloriesUnit: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: -2,
  },
  macroColumn: {
    gap: 2,
    minWidth: 120,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  macroLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  breakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  link: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  linkMuted: {
    fontSize: 13,
    opacity: 0.6,
    textDecorationLine: 'underline',
  },
  breakdown: {
    marginTop: 8,
  },
  breakdownBlock: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.4)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    gap: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  group: {
    marginBottom: 18,
  },
  groupHeader: {
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupHint: {
    fontSize: 13,
    opacity: 0.6,
  },
  groupHintRequired: {
    color: '#C05621',
    opacity: 1,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 6,
  },
  valueRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 104, 56, 0.07)',
  },
  valueText: {
    flex: 1,
  },
  valueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueName: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  valueMeta: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.6,
    marginTop: 1,
  },
  halalMini: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperValue: {
    minWidth: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    marginBottom: 8,
  },
  servingsValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  inlineLink: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  manualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  manualField: {
    width: '48%',
    marginBottom: 10,
  },
  manualLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 4,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  manualInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 9,
  },
  manualUnit: {
    fontSize: 13,
    opacity: 0.6,
  },
  citations: {
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
  },
  logButtonDisabled: {
    opacity: 0.45,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

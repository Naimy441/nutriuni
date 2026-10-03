// Nutrition for a Mobile Order dish with the diner's option choices.
// Pure functions (no React) so the same logic runs in the app and in
// scripts/verify-menu-data.ts against every bundled menu.
import type { FoodLabel, MenuItem, OptionGroup, RestaurantMenu } from './menuTypes';

export const NUTRIENT_KEYS = [
  'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium',
  'saturated_fat', 'trans_fat', 'cholesterol', 'added_sugar',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type NutritionTotals = Record<NutrientKey, number>;

// complete: every selected part has a label. partial: some selections have no
// label and are left out. none: nothing to compute from.
export type NutritionStatus = 'complete' | 'partial' | 'none';

export interface NutritionPart {
  name: string;
  label: FoodLabel;
  quantity: number;
  sign: 1 | -1;
}

export interface NutritionResult {
  status: NutritionStatus;
  totals: NutritionTotals | null;
  // Built from components (combos, build-your-own) or with substitutions or
  // size changes the labels can't reflect.
  estimated: boolean;
  missing: string[];
  parts: NutritionPart[];
  base: FoodLabel | null;
}

// selection[group][value] = how many of that value are chosen (0 = not chosen).
export type Selection = number[][];

// Tags assumed when no option says otherwise: a plain "Latte" is whole milk.
const DEFAULT_TAGS = new Set(['whole', 'regular', 'original']);

export function emptyTotals(): NutritionTotals {
  return Object.fromEntries(NUTRIENT_KEYS.map(key => [key, 0])) as NutritionTotals;
}

export function groupMax(group: OptionGroup): number {
  return group.max ?? (group.allow_quantity ? Infinity : group.values.length);
}

export function isSingleChoice(group: OptionGroup): boolean {
  return group.max === 1;
}

export function defaultSelection(item: MenuItem): Selection {
  return (item.options ?? []).map(group => group.values.map(value => (value.default ? 1 : 0)));
}

export function selectedCount(selection: Selection, groupIndex: number): number {
  return (selection[groupIndex] ?? []).reduce((sum, quantity) => sum + quantity, 0);
}

// Tap on a value: radio behaviour for single-choice groups, checkbox otherwise
// (never exceeding the group's maximum).
export function toggleValue(item: MenuItem, selection: Selection, groupIndex: number, valueIndex: number): Selection {
  const group = item.options?.[groupIndex];
  if (!group) return selection;
  const next = selection.map(row => [...row]);
  const row = next[groupIndex];
  if (row[valueIndex] > 0) {
    if (isSingleChoice(group) && group.min >= 1) return selection;
    row[valueIndex] = 0;
    return next;
  }
  if (isSingleChoice(group)) {
    row.fill(0);
  } else if (selectedCount(selection, groupIndex) >= groupMax(group)) {
    return selection;
  }
  row[valueIndex] = 1;
  return next;
}

export function setValueQuantity(
  item: MenuItem, selection: Selection, groupIndex: number, valueIndex: number, quantity: number,
): Selection {
  const group = item.options?.[groupIndex];
  const value = group?.values[valueIndex];
  if (!group || !value) return selection;
  const others = selectedCount(selection, groupIndex) - (selection[groupIndex][valueIndex] ?? 0);
  const limit = Math.min(groupMax(group) - others, value.max_quantity ?? Infinity);
  const next = selection.map(row => [...row]);
  next[groupIndex][valueIndex] = Math.max(0, Math.min(quantity, limit));
  return next;
}

// Groups that still need a choice before the order makes sense.
export function unmetChoices(item: MenuItem, selection: Selection): OptionGroup[] {
  return (item.options ?? []).filter((group, index) => selectedCount(selection, index) < group.min);
}

function selectedTags(item: MenuItem, selection: Selection): Set<string> {
  const tags = new Set<string>();
  (item.options ?? []).forEach((group, g) =>
    group.values.forEach((value, v) => {
      if (selection[g]?.[v] > 0) value.tags?.forEach(tag => tags.add(tag));
    }),
  );
  return tags;
}

// Cup sizes come from the label's serving and are only a preference: the
// right milk in the wrong size beats the wrong milk.
const SIZE_TAGS = new Set(['small', 'medium', 'large', 'regular']);

// Must match pick_variant() in build_nutriuni_menus.py.
export function resolveBase(item: MenuItem, selection: Selection): string | undefined {
  return resolveVariant(item, selection).food;
}

// sizeMismatch: a cup size was chosen but the best label is another size.
function resolveVariant(item: MenuItem, selection: Selection): { food?: string; sizeMismatch: boolean } {
  if (!item.variants?.length) return { food: item.base, sizeMismatch: false };
  const selected = selectedTags(item, selection);
  let best: { food: string; need: string[]; score: [number, number] } | null = null;
  for (const variant of item.variants) {
    const sizes = variant.need.filter(tag => SIZE_TAGS.has(tag));
    const others = variant.need.filter(tag => !SIZE_TAGS.has(tag));
    if (!others.every(tag => selected.has(tag) || DEFAULT_TAGS.has(tag))) continue;
    const score: [number, number] = [
      3 * others.filter(tag => selected.has(tag)).length
        + sizes.filter(tag => selected.has(tag)).length
        - sizes.filter(tag => !selected.has(tag) && !DEFAULT_TAGS.has(tag)).length,
      -variant.need.length,
    ];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) {
      best = { food: variant.food, need: variant.need, score };
    }
  }
  if (!best) return { food: item.base, sizeMismatch: false };
  const chosenSizes = [...selected].filter(tag => SIZE_TAGS.has(tag));
  const labelSizes = best.need.filter(tag => SIZE_TAGS.has(tag));
  const sizeMismatch = chosenSizes.length > 0 && labelSizes.length > 0 && !labelSizes.some(tag => selected.has(tag));
  return { food: best.food, sizeMismatch };
}

export function hasNutritionSource(item: MenuItem): boolean {
  return Boolean(item.base || item.components?.length || item.composed || item.variants?.length);
}

export function computeNutrition(
  menu: Pick<RestaurantMenu, 'foods'>,
  item: MenuItem,
  selection: Selection,
  servings = 1,
): NutritionResult {
  const parts: NutritionPart[] = [];
  const missing: string[] = [];
  let estimated = Boolean(item.composed);

  const { food: baseId, sizeMismatch } = resolveVariant(item, selection);
  if (sizeMismatch) estimated = true;
  const base = baseId ? menu.foods[baseId] ?? null : null;
  // Parts a "No X" option may take away, each at most once per serving.
  const removable: string[] = [];
  if (base && baseId) {
    parts.push({ name: item.name, label: base, quantity: item.base_quantity ?? 1, sign: 1 });
    removable.push(baseId);
  }
  for (const id of item.components ?? []) {
    const label = menu.foods[id];
    if (label) {
      parts.push({ name: label.name, label, quantity: 1, sign: 1 });
      removable.push(id);
    }
  }

  (item.options ?? []).forEach((group, g) =>
    group.values.forEach((value, v) => {
      const chosen = selection[g]?.[v] ?? 0;
      if (chosen <= 0) return;
      const label = value.food ? menu.foods[value.food] : undefined;
      switch (value.kind) {
        case 'add':
          if (label) {
            parts.push({ name: value.name, label, quantity: chosen * (value.quantity ?? 1), sign: 1 });
          } else {
            missing.push(value.name);
          }
          break;
        case 'remove': {
          const index = value.food ? removable.indexOf(value.food) : -1;
          if (label && index >= 0) {
            removable.splice(index, 1);
            parts.push({ name: value.name, label, quantity: 1, sign: -1 });
          }
          break;
        }
        case 'sub':
        case 'size':
          estimated = true;
          break;
      }
    }),
  );

  const hasSource = Boolean(base || item.components?.length || (item.composed && parts.length));
  if (!hasSource) {
    return { status: 'none', totals: null, estimated: false, missing, parts: [], base: null };
  }
  const totals = emptyTotals();
  for (const part of parts) {
    for (const key of NUTRIENT_KEYS) {
      totals[key] += part.sign * part.quantity * (part.label[key] ?? 0);
    }
  }
  for (const key of NUTRIENT_KEYS) {
    totals[key] = round(Math.max(0, totals[key] * servings), key === 'calories' || key === 'sodium' || key === 'cholesterol' ? 0 : 1);
  }
  return { status: missing.length ? 'partial' : 'complete', totals, estimated, missing, parts, base };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Human-readable choices for the food log: "Fries, Ranch x2, No Pickle".
export function selectionSummary(item: MenuItem, selection: Selection): string {
  const chosen: string[] = [];
  (item.options ?? []).forEach((group, g) =>
    group.values.forEach((value, v) => {
      const quantity = selection[g]?.[v] ?? 0;
      if (quantity > 0) chosen.push(quantity > 1 ? `${value.name} x${quantity}` : value.name);
    }),
  );
  return chosen.join(', ');
}

// What the menu list shows before the diner opens a dish.
export function previewNutrition(menu: Pick<RestaurantMenu, 'foods'>, item: MenuItem): NutritionResult {
  return computeNutrition(menu, item, defaultSelection(item));
}

export type PreviewKind = 'complete' | 'estimated' | 'partial' | 'choose' | 'none';

// One line for menu lists: the default order's calories, or why there are none.
// Combos and build-your-own dishes are mostly what the diner picks; without
// default picks their base alone would understate the order.
function needsPicks(item: MenuItem): boolean {
  if (!item.composed) return false;
  return !(item.options ?? []).some(group => group.values.some(value => value.default && value.kind === 'add' && value.food));
}

export function describePreview(
  menu: Pick<RestaurantMenu, 'foods'>,
  item: MenuItem,
): { kind: PreviewKind; calories?: number } {
  if (needsPicks(item)) return { kind: 'choose' };
  const result = previewNutrition(menu, item);
  if (result.totals) {
    const kind = result.status === 'partial' ? 'partial' : result.estimated ? 'estimated' : 'complete';
    return { kind, calories: result.totals.calories };
  }
  return { kind: hasNutritionSource(item) ? 'choose' : 'none' };
}

// Whether "+" can log the default order straight away.
export function canQuickLog(menu: Pick<RestaurantMenu, 'foods'>, item: MenuItem): boolean {
  if (needsPicks(item)) return false;
  const selection = defaultSelection(item);
  return computeNutrition(menu, item, selection).status !== 'none' && unmetChoices(item, selection).length === 0;
}

// Nutrition for a Mobile Order dish with the diner's option choices.
// Pure functions (no React) so the same logic runs in the app and in
// scripts/verify-menu-data.ts against every bundled menu.
import type { FoodLabel, MenuItem, OptionGroup, OptionValue, RestaurantMenu } from './menuTypes';

export const NUTRIENT_KEYS = [
  'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium',
  'saturated_fat', 'trans_fat', 'cholesterol', 'added_sugar',
  'calcium', 'iron', 'potassium',
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
  // Nutrients some part's label doesn't list, so the total isn't known.
  unknown: NutrientKey[];
  // Nutrients removed because the published number cannot be right.
  withheld: NutrientKey[];
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

// Gothic Grill's published beef patty. "Double Burger" is sold as an add-on
// on several grills but the menu build never linked it to a label, so
// choosing it (or raising its quantity) left calories unchanged. Kitchens
// without their own patty label use this one and the order is marked estimated.
const PUBLISHED_BEEF_PATTY: FoodLabel = {
  name: 'Beef Patty',
  serving_size: 'Patty (62g)',
  calories: 160,
  protein: 14,
  carbs: 0,
  fat: 11,
  fiber: 0,
  sugar: 0,
  sodium: 650,
  saturated_fat: 3.5,
  trans_fat: 0,
  cholesterol: 50,
  calcium: 15,
  iron: 1.47,
  potassium: 190,
  halal: true,
  last_seen: '2025-09-01',
};

function findFood(menu: Pick<RestaurantMenu, 'foods'>, pattern: RegExp): FoodLabel | undefined {
  return Object.values(menu.foods).find(food => pattern.test(food.name));
}

// An add-on the menu builder left unlinked, but whose name tells us which
// label to add. Returns null when we should keep treating it as missing.
export function implicitAddFood(
  menu: Pick<RestaurantMenu, 'foods'>,
  value: OptionValue,
): { label: FoodLabel; estimated: boolean } | null {
  if (value.kind !== 'add' || value.food) return null;
  const name = value.name.trim();
  if (/^double burger$/i.test(name)) {
    const patty = findFood(menu, /^beef patty$/i);
    return patty ? { label: patty, estimated: false } : { label: PUBLISHED_BEEF_PATTY, estimated: true };
  }
  if (/^double cheese$/i.test(name)) {
    const cheddar = findFood(menu, /^cheddar cheese slice$/i);
    if (cheddar) return { label: cheddar, estimated: false };
  }
  return null;
}

function servingGrams(serving: string | null | undefined): number | null {
  const match = serving?.match(/\((\d+(?:\.\d+)?)\s*g\)/);
  return match ? Number(match[1]) : null;
}

const GRAM_NUTRIENTS: NutrientKey[] = ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'saturated_fat', 'trans_fat', 'added_sugar'];

function isImplausibleBeverage(food: FoodLabel): boolean {
  if (/brownie|bread|cake|cookie|muffin|sorbet|sundae|ice cream|pudding|patty|burger/i.test(food.name)) return false;
  if (!/hot chocolate|cocoa|coffee|latte|cappuccino|espresso|americano|mocha|tea\b|juice|soda|smoothie|frappe|lemonade|milkshake|\bchai\b|cider|au lait|cola/i.test(food.name)) {
    return false;
  }
  const grams = servingGrams(food.serving_size);
  if (!grams || grams <= 0) return false;
  // A cafe drink is mostly water. Above ~1.5 kcal/g it is denser than sweetened
  // condensed milk; carbs above ~28% of the cup are a syrup, not a beverage.
  // Milk-based hot chocolate (about 1 kcal/g and ~3 g protein per 100 g) stays.
  if (food.calories / grams > 1.5) return true;
  if ((food.carbs ?? 0) / grams > 0.28) return true;
  return false;
}

// Drop or correct label fields that cannot describe the serving. The Duke
// library maps NetNutrition rows by name; a few rows still land on the wrong
// nutrient (a salsa whose "sugar" is heavier than the spoon) or describe a
// drink no cup could hold. Plausible values, including a medium hot
// chocolate's protein from the milk, are left alone.
export function prepareLabel(food: FoodLabel): { label: FoodLabel | null; withheld: NutrientKey[] } {
  if (isImplausibleBeverage(food)) {
    const withheld = NUTRIENT_KEYS.filter(key => key !== 'calories' && food[key] !== undefined);
    withheld.unshift('calories');
    return { label: null, withheld };
  }
  const next: FoodLabel = { ...food };
  const withheld: NutrientKey[] = [];
  const drop = (key: NutrientKey) => {
    if (next[key] !== undefined) {
      withheld.push(key);
      delete next[key];
    }
  };
  const grams = servingGrams(food.serving_size);
  if (grams != null) {
    for (const key of GRAM_NUTRIENTS) {
      const value = next[key];
      if (value != null && value > grams + 0.5) drop(key);
    }
    // "132 g sugar" on a 28 g salsa is the sodium figure (mg) stored as sugar.
    if (withheld.includes('sugar') && next.sodium === undefined && food.sugar != null && food.sugar >= 20 && food.sugar <= 5000) {
      next.sodium = Math.round(food.sugar);
    }
  }
  const capOrDrop = (child: NutrientKey, parent: NutrientKey) => {
    const childValue = next[child];
    const parentValue = next[parent];
    if (childValue == null || parentValue == null || childValue <= parentValue) return;
    const over = childValue - parentValue;
    const slop = Math.max(5, parentValue * 0.08);
    if (over <= slop) next[child] = parentValue;
    else drop(child);
  };
  capOrDrop('sugar', 'carbs');
  capOrDrop('fiber', 'carbs');
  capOrDrop('added_sugar', 'sugar');
  capOrDrop('added_sugar', 'carbs');
  capOrDrop('saturated_fat', 'fat');
  capOrDrop('trans_fat', 'fat');
  if (next.protein != null && next.calories > 0 && next.protein * 4 > next.calories + 30) drop('protein');
  const atwater = 4 * (next.protein ?? 0) + 4 * (next.carbs ?? 0) + 9 * (next.fat ?? 0);
  if (next.calories >= 40 && atwater > 0) {
    const ratio = atwater / next.calories;
    if (ratio < 0.45 || ratio > 2) {
      for (const key of ['protein', 'carbs', 'fat'] as const) drop(key);
    }
  }
  return { label: next, withheld };
}

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
  const withheld: NutrientKey[] = [];
  let estimated = Boolean(item.composed);

  const take = (label: FoodLabel | null | undefined): FoodLabel | null => {
    if (!label) return null;
    const prepared = prepareLabel(label);
    for (const key of prepared.withheld) {
      if (!withheld.includes(key)) withheld.push(key);
    }
    return prepared.label;
  };

  const { food: baseId, sizeMismatch } = resolveVariant(item, selection);
  if (sizeMismatch) estimated = true;
  const base = baseId ? menu.foods[baseId] ?? null : null;
  const baseLabel = take(base);
  // Parts a "No X" option may take away, each at most once per serving.
  const removable: string[] = [];
  if (baseLabel && baseId) {
    parts.push({ name: item.name, label: baseLabel, quantity: item.base_quantity ?? 1, sign: 1 });
    removable.push(baseId);
  } else if (base && !baseLabel) {
    missing.push(item.name);
  }
  for (const id of item.components ?? []) {
    const label = take(menu.foods[id]);
    if (label) {
      parts.push({ name: label.name, label, quantity: 1, sign: 1 });
      removable.push(id);
    }
  }

  (item.options ?? []).forEach((group, g) =>
    group.values.forEach((value, v) => {
      const chosen = selection[g]?.[v] ?? 0;
      if (chosen <= 0) return;
      const linked = value.food ? menu.foods[value.food] : undefined;
      const implicit = !linked && value.kind === 'add' ? implicitAddFood(menu, value) : null;
      if (implicit?.estimated) estimated = true;
      const label = take(linked ?? implicit?.label);
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
  if (!hasSource || parts.length === 0) {
    return { status: 'none', totals: null, estimated: false, missing, unknown: [], withheld, parts: [], base: null };
  }
  const totals = emptyTotals();
  for (const part of parts) {
    for (const key of NUTRIENT_KEYS) {
      totals[key] += part.sign * part.quantity * (part.label[key] ?? 0);
    }
  }
  for (const key of NUTRIENT_KEYS) {
    totals[key] = round(Math.max(0, totals[key] * servings), WHOLE_NUMBERS.has(key) ? 0 : 1);
  }
  const unknown = NUTRIENT_KEYS.filter(key =>
    withheld.includes(key) || parts.some(part => part.sign > 0 && part.label[key] === undefined));
  return { status: missing.length ? 'partial' : 'complete', totals, estimated, missing, unknown, withheld, parts, base: baseLabel };
}

const WHOLE_NUMBERS = new Set<NutrientKey>(['calories', 'sodium', 'cholesterol', 'calcium', 'potassium']);

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

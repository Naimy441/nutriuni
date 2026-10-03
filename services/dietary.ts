// Diets, halal and allergens: the user's preferences, and what a dish's
// NetNutrition icons say about it. Pure functions, shared by the app and
// scripts/verify-planner.ts.
//
// The icons only ever say what a label *is* marked with. Nothing here treats
// a missing mark as "free of" an allergen or "not vegetarian": unmarked means
// unknown, and kitchens that publish no icons are unknown for everything.
import { computeNutrition, defaultSelection, Selection } from './menuNutrition';
import type { FoodLabel, MenuItem, RestaurantMenu } from './menuTypes';

export type Allergen = 'milk' | 'egg' | 'wheat' | 'gluten' | 'soy' | 'peanut' | 'tree_nut' | 'fish' | 'shellfish' | 'sesame';
export type Diet = 'none' | 'vegetarian' | 'vegan';

export const ALLERGENS: { code: Allergen; label: string }[] = [
  { code: 'milk', label: 'Milk' },
  { code: 'egg', label: 'Egg' },
  { code: 'wheat', label: 'Wheat' },
  { code: 'gluten', label: 'Gluten' },
  { code: 'soy', label: 'Soy' },
  { code: 'peanut', label: 'Peanut' },
  { code: 'tree_nut', label: 'Tree nuts' },
  { code: 'fish', label: 'Fish' },
  { code: 'shellfish', label: 'Shellfish' },
  { code: 'sesame', label: 'Sesame' },
];

export function allergenLabel(code: string): string {
  return ALLERGENS.find(a => a.code === code)?.label ?? code;
}

// "milk, egg and soy"
export function allergenList(codes: string[]): string {
  const labels = codes.map(code => allergenLabel(code).toLowerCase());
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

// Labels don't always carry the icons they should (a provolone sandwich with
// no milk icon, a glass of milk with none), so names are checked too. These
// lists only ever add caution: a hit makes a dish "may contain" or "not
// vegetarian", never the other way round.
const ALLERGEN_WORDS: Record<Allergen, RegExp> = {
  milk: /\b(milk|dairy|cheese|cheesy|cheddar|mozzarella|provolone|parmesan|parm|feta|ricotta|brie|gouda|swiss|american cheese|pepper jack|queso|cotija|paneer|cream|creamy|butter|buttermilk|yogurt|yoghurt|latte|cappuccino|mocha|macchiato|alfredo|ranch|tzatziki|raita|lassi|ghee|whey|custard|ice cream|gelato|frappe|smoothie|shake|pimento|melt|cheesecake|quesadilla|parmigiana|caprese|tiramisu|mac and cheese|mac & cheese|grilled cheese)\b/i,
  egg: /\b(eggs?|omelet|omelette|scrambler|scrambled|frittata|quiche|mayo|mayonnaise|aioli|custard|meringue|french toast|hollandaise|carbonara|caesar)\b/i,
  wheat: /\b(bread|bun|roll|ciabatta|baguette|focaccia|wrap|flatbread|pita|naan|pizza|calzone|pasta|spaghetti|penne|rigatoni|fettuccine|linguine|macaroni|lasagna|manicotti|ravioli|noodles?|ramen|udon|lo mein|tortilla|burrito|quesadilla|bagel|croissant|toast|sandwich|sub|hoagie|panini|biscuits?|waffles?|pancakes?|crepes?|muffin|cookie|cake|brownie|donut|doughnut|pastry|danish|scone|breaded|crouton|couscous|dumplings?|tempura|pretzel|cracker|churros?|seitan)\b/i,
  gluten: /\b(bread|bun|roll|ciabatta|baguette|focaccia|wrap|flatbread|pita|naan|pizza|calzone|pasta|spaghetti|penne|rigatoni|fettuccine|linguine|macaroni|lasagna|manicotti|ravioli|noodles?|ramen|udon|lo mein|tortilla|burrito|quesadilla|bagel|croissant|toast|sandwich|sub|hoagie|panini|biscuits?|waffles?|pancakes?|crepes?|muffin|cookie|cake|brownie|donut|doughnut|pastry|danish|scone|breaded|crouton|couscous|dumplings?|tempura|pretzel|cracker|churros?|seitan|barley|rye|beer)\b/i,
  soy: /\b(soy|soya|tofu|edamame|miso|tempeh|teriyaki)\b/i,
  peanut: /\b(peanuts?|pb&j|pb|satay|pad thai)\b/i,
  tree_nut: /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamia|nutella|praline|pesto|marzipan|nuts?)\b/i,
  fish: /\b(fish|salmon|tuna|cod|tilapia|mahi|catfish|trout|halibut|anchov(y|ies)|sardines?|swordfish|bass|snapper|pollock|haddock|sushi|sashimi|poke|caesar)\b/i,
  shellfish: /\b(shrimp|prawns?|crab|lobster|scallops?|clams?|oysters?|mussels?|crawfish|crayfish|calamari|squid|octopus)\b/i,
  sesame: /\b(sesame|tahini|hummus|halva|furikake)\b/i,
};
const GLUTEN_FREE = /\b(gluten[- ]free|gf)\b/i;
const DAIRY_FREE = /\b(dairy[- ]free|non[- ]?dairy|vegan)\b/i;
const EGG_FREE = /\b(egg[- ]free|eggless|vegan)\b/i;
const MEAT_WORDS = /\b(chicken|beef|pork|bacon|ham|turkey|sausages?|pepperoni|salami|prosciutto|steak|lamb|gyro|meatballs?|meatloaf|brisket|carnitas|barbacoa|chorizo|pastrami|duck|veal|venison|jerky|hot dog|wings?|burger|fish|salmon|tuna|cod|tilapia|mahi|catfish|shrimp|crab|lobster|scallops?|anchov(y|ies)|clams?|oysters?|calamari)\b/i;
const PLANT_BASED = /\b(vegan|vegetarian|veggie|plant[- ]based|impossible|beyond|nadura|tofu|meatless|seitan|tempeh|falafel)\b/i;
const ANIMAL_PRODUCTS = /\b(honey|gelatin)\b/i;

// What a dish's names suggest about it. Each name is read on its own, so a
// "Vegan Burger" with "Bacon" added still reads as meat.
export function nameHints(texts: string[]): { mayContain: Allergen[]; meat: boolean; animal: boolean } {
  const found = new Set<Allergen>();
  let meat = false;
  let animal = false;
  for (const text of texts.filter(Boolean)) {
    for (const { code } of ALLERGENS) {
      if ((code === 'wheat' || code === 'gluten') && GLUTEN_FREE.test(text)) continue;
      if (code === 'milk' && DAIRY_FREE.test(text)) continue;
      if (code === 'egg' && EGG_FREE.test(text)) continue;
      if (ALLERGEN_WORDS[code].test(text)) found.add(code);
    }
    meat ||= MEAT_WORDS.test(text) && !PLANT_BASED.test(text);
    animal ||= ANIMAL_PRODUCTS.test(text);
  }
  return { mayContain: ALLERGENS.map(a => a.code).filter(code => found.has(code)), meat, animal };
}

export interface FoodPreferences {
  diet: Diet;
  halal: boolean; // halal-certified dishes, plus vegetarian ones
  avoid: Allergen[];
}

export const NO_PREFERENCES: FoodPreferences = { diet: 'none', halal: false, avoid: [] };

export function hasPreferences(prefs: FoodPreferences): boolean {
  return prefs.diet !== 'none' || prefs.halal || prefs.avoid.length > 0;
}

// What the icons say about a dish (as ordered, or its default order).
export interface DishDietary {
  known: boolean; // at least one label backs this dish
  contains: Allergen[]; // marked on a label
  mayContain: Allergen[]; // not marked, but its name suggests it
  vegetarian: boolean; // every part is marked vegetarian
  vegan: boolean; // every part is marked vegan
  halal: boolean; // every part is marked halal or vegetarian
  halalCertified: boolean; // the dish itself is marked halal
  allergenInfo: boolean; // the kitchen publishes allergen icons
  dietInfo: boolean; // the kitchen publishes vegetarian / vegan icons
}

export function dietaryOf(
  labels: FoodLabel[],
  kitchen: { allergen_info?: boolean; diet_info?: boolean },
  halalCertified = false,
  names: string[] = [],
): DishDietary {
  const contains = new Set<Allergen>();
  for (const label of labels) label.contains?.forEach(code => contains.add(code as Allergen));
  const hints = nameHints([...names, ...labels.map(label => label.name)]);
  const all = (test: (label: FoodLabel) => boolean) => labels.length > 0 && labels.every(test);
  const markedVegetarian = all(label => Boolean(label.diet?.includes('vegetarian') || label.diet?.includes('vegan')));
  const vegetarian = markedVegetarian && !hints.meat;
  const vegan = vegetarian && all(label => Boolean(label.diet?.includes('vegan')))
    && !hints.animal && !hints.mayContain.some(code => code === 'milk' || code === 'egg');
  const ordered = ALLERGENS.map(a => a.code);
  return {
    known: labels.length > 0,
    contains: ordered.filter(code => contains.has(code)),
    mayContain: hints.mayContain.filter(code => !contains.has(code)),
    vegetarian,
    vegan,
    halal: halalCertified || (!hints.meat && all(label => label.halal || Boolean(label.diet?.includes('vegetarian') || label.diet?.includes('vegan'))))
      || all(label => label.halal),
    halalCertified,
    allergenInfo: Boolean(kitchen.allergen_info),
    dietInfo: Boolean(kitchen.diet_info),
  };
}

// The labels in an order: the dish and everything added to it.
export function dishDietary(menu: RestaurantMenu, item: MenuItem, selection: Selection = defaultSelection(item)): DishDietary {
  const result = computeNutrition(menu, item, selection);
  const parts = result.parts.filter(part => part.sign > 0);
  const names = [item.name, item.description ?? '', ...parts.map(part => part.name)];
  return dietaryOf(parts.map(part => part.label), menu, Boolean(item.halal), names);
}

export interface PreferenceCheck {
  fits: boolean; // marked as fitting every preference
  conflicts: Allergen[]; // marked allergens the user avoids
  possible: Allergen[]; // allergens the user avoids that its name suggests
  unknown: ('diet' | 'halal' | 'allergens')[]; // preferences the icons can't confirm
}

export function checkPreferences(dish: DishDietary, prefs: FoodPreferences): PreferenceCheck {
  const conflicts = dish.contains.filter(code => prefs.avoid.includes(code));
  const possible = dish.mayContain.filter(code => prefs.avoid.includes(code));
  const unknown: PreferenceCheck['unknown'] = [];
  let fits = conflicts.length === 0 && possible.length === 0;
  if (prefs.diet !== 'none' && !(prefs.diet === 'vegan' ? dish.vegan : dish.vegetarian)) {
    fits = false;
    if (!dish.dietInfo || !dish.known) unknown.push('diet');
  }
  if (prefs.halal && !dish.halal) {
    fits = false;
    if (!dish.known) unknown.push('halal');
  }
  if (prefs.avoid.length && (!dish.allergenInfo || !dish.known)) {
    // Nothing marked, but the kitchen doesn't mark allergens: can't vouch for it.
    fits = false;
    unknown.push('allergens');
  }
  return { fits, conflicts, possible, unknown };
}

// A short label for the "fits my diet" filter: "Vegetarian", "Halal",
// "Vegan · no peanut", "No milk or egg".
export function preferencesLabel(prefs: FoodPreferences): string {
  const parts: string[] = [];
  if (prefs.diet !== 'none') parts.push(prefs.diet === 'vegan' ? 'Vegan' : 'Vegetarian');
  if (prefs.halal) parts.push('Halal');
  if (prefs.avoid.length) {
    const avoid = prefs.avoid.length <= 2 ? prefs.avoid.map(code => allergenLabel(code).toLowerCase()).join(' or ') : 'my allergens';
    parts.push(parts.length ? `no ${avoid}` : `No ${avoid}`);
  }
  return parts.join(' · ');
}

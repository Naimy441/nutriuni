// Demo data for store screenshots: a student two weeks into using nutriuni,
// eating real Duke dining dishes. Loaded in development only, by opening
// nutriuni://screenshot-seed (see screenshots/README.md). Replaces all data
// on the device.
import { appearanceStore } from '@/services/appearance';
import { addDays, dayKey } from '@/services/dates';
import { fastAccessService } from '@/services/FastAccessService';
import { goalsStore, UserProfile } from '@/services/goals';
import type { MealType } from '@/services/meals';
import { menuDatabase } from '@/services/MenuDatabase';
import { quickLogEntry } from '@/services/menuLogging';
import { nutritionTracker } from '@/services/NutritionTracker';
import { preferencesStore } from '@/services/preferences';

// About 2,140 cal and 98 g protein a day.
const PROFILE: UserProfile = {
  age: 20,
  weight: 135,
  heightFeet: 5,
  heightInches: 5,
  gender: 'female',
  activityLevel: 1.55,
  goal: 'maintain',
};

type Dish = [restaurant: string, name: string];

const BREAKFASTS: Dish[][] = [
  [['saladelia-sanford', 'Granola Parfait']],
  [['farmstead-and-sprout-sandwiches', 'Avocado Toast']],
  [['the-devil-s-krafthouse', 'Turkey Sausage Egg and Cheese Bagel']],
  [['farmstead-and-sprout-sandwiches', 'Breakfast burrito'], ['bseisu-coffee-bar', 'Cafe Latte 2% Milk']],
  [['cafe', 'Greek Scrambler']],
  [['pitchfork-s', 'Lox & Bagel']],
  [['cafe', 'Egg n Cheese Croissant'], ['cafe', 'Green Monster']],
];

const LUNCHES: Dish[][] = [
  [['saladelia-sanford', 'Salmon Bowl']],
  [['cafe', 'Chicken Pesto Crepe']],
  [['gothic-grill', 'Grilled Chicken salad']],
  [['saladelia-perkins', 'Falafel']],
  [['gyotaku', 'Pacific'], ['gyotaku', 'EDAMAME']],
  [['farmstead-and-sprout-sandwiches', 'Honey Garlic Chicken'], ['jb-s-roast-and-chops', 'Brown Rice']],
  [['gothic-grill', 'Buffalo Chicken Mac and Cheese']],
];

const DINNERS: Dish[][] = [
  [['jb-s-roast-and-chops', 'Ultimate Grilled Chicken Sandwich']],
  [['il-forno', 'Chicken Alfredo'], ['il-forno', 'Breadstick']],
  [['farmstead-and-sprout-sandwiches', 'Tangy Bourbon Chicken (Sweet Potatoes & Green Beans)'], ['jb-s-roast-and-chops', 'Garlic Mashed Potatoes']],
  [['tandoor', 'Masala Dosai'], ['tandoor', 'Naan']],
  [['ginger-and-soy', 'Soup Dumplings'], ['ginger-and-soy', 'Steamed Vegetable Dumplings']],
  [['pitchfork-s', 'Chicken Parmesan']],
  [['gyotaku', 'Salmon Avocado'], ['gyotaku', 'Red Dragon']],
];

const SNACKS: Dish[][] = [
  [['red-mango', 'Mighty Oat Reg']],
  [['gyotaku', 'EDAMAME']],
  [['red-mango', 'Strawberry Banana Regular']],
  [['the-skillet', 'Vanilla Greek Yogurt Cup'], ['saladelia-sanford', 'Fresh Fruit']],
  [['bseisu-coffee-bar', 'Blueberry Bagel']],
];

// Today so far: breakfast, lunch and a snack, with dinner still to plan.
const TODAY: [MealType, Dish[]][] = [
  ['breakfast', [['the-devil-s-krafthouse', 'Turkey Sausage Egg and Cheese Bagel']]],
  ['lunch', [['cafe', 'Chicken Pesto Crepe']]],
  ['snack', [['saladelia-sanford', 'Farm Fresh Eggs']]],
];

const HISTORY_DAYS = 13;
// A latte on a couple of days keeps the week on target, so today's plan
// isn't stretched to make up for it.
const LATTE_DAYS = [2, 3];

async function log(dishes: Dish[], date: string, meal: MealType) {
  for (const [restaurant, name] of dishes) {
    const menu = menuDatabase.loadRestaurant(restaurant);
    const item = menu?.sections.flatMap(section => section.items).find(dish => dish.name === name);
    if (!menu || !item) throw new Error(`Demo dish not found: ${name} at ${restaurant}`);
    await nutritionTracker.addTrackedItem(quickLogEntry(menu, item), { date, meal });
  }
}

export async function seedScreenshotData(): Promise<void> {
  await nutritionTracker.clearAll();
  await fastAccessService.clearAll();
  await preferencesStore.reset();
  await appearanceStore.set('system');
  await goalsStore.completeOnboarding(PROFILE);

  await fastAccessService.saveCustomMeal({
    name: 'Protein oats', restaurant: '', serving_size: '1 bowl', nutrition_status: 'manual',
    calories: 420, protein: 30, carbs: 55, fat: 9, fiber: 8, sugar: 12, sodium: 180,
  });
  await fastAccessService.saveCustomMeal({
    name: 'Post-workout shake', restaurant: '', serving_size: '16 oz', nutrition_status: 'manual',
    calories: 280, protein: 40, carbs: 18, fat: 5, fiber: 2, sugar: 9, sodium: 220,
  });

  const today = dayKey();
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const date = addDays(today, -back);
    await log(BREAKFASTS[back % BREAKFASTS.length], date, 'breakfast');
    if (LATTE_DAYS.includes(back)) await log([['bseisu-coffee-bar', 'Cafe Latte 2% Milk']], date, 'breakfast');
    await log(LUNCHES[(back * 3) % LUNCHES.length], date, 'lunch');
    await log(DINNERS[(back * 5) % DINNERS.length], date, 'dinner');
    await log(SNACKS[back % SNACKS.length], date, 'snack');
  }
  for (const [meal, dishes] of TODAY) await log(dishes, today, meal);
}

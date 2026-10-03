// Checks the weekly meal planner: week balancing, meal splits and food
// suggestions against the bundled menus.
//
//   npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-planner.js
import * as fs from 'fs';
import * as path from 'path';
import { addDays, weekOf } from '../services/dates';
import type { MealType } from '../services/meals';
import type { MenuIndex, RestaurantMenu } from '../services/menuTypes';
import { checkPreferences, dietaryOf, dishDietary, FoodPreferences, NO_PREFERENCES } from '../services/dietary';
import { fastingTimes } from '../services/fastingTimes';
import {
  buildMenuPool, buildSavedPool, categorize, dayOf, familiarityMap, learnMealShares, LoggedDay, mealWindow,
  openDuring, planMeals, planWeek, recommend, SavedFood, weekMessage, DEFAULT_SHARES,
} from '../services/planner';
import { DEFAULT_SCHEDULE, EatingSchedule, mealAt, mealSlots } from '../services/schedule';

const STANDARD = mealSlots(DEFAULT_SCHEDULE, '2026-10-04');
const slotWindow = (meal: MealType) => {
  const slot = STANDARD.find(s => s.meal === meal)!;
  return { start: slot.start, end: slot.end };
};

const failures: string[] = [];
let passes = 0;
function check(label: string, condition: boolean, detail = '') {
  if (condition) passes++;
  else failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

const G = 2000;
const P = 120;
const goals = { calories: G, protein: P };
// 2026-10-04 is a Sunday, so its week runs 10-04 … 10-10.
const SUNDAY = '2026-10-04';
const week = weekOf(SUNDAY);
check('week starts on Sunday', week[0] === SUNDAY && week[6] === '2026-10-10', week.join(','));

function day(date: string, calories: number, protein = calories * 0.06, byMeal: LoggedDay['byMeal'] = {}): LoggedDay {
  return { date, calories, protein, items: calories > 0 ? 3 : 0, byMeal };
}
function logs(...days: LoggedDay[]) {
  return new Map(days.map(d => [d.date, d]));
}

// 1. A week on target keeps every day at the daily goal.
{
  const plan = planWeek({ today: week[3], logs: logs(day(week[0], 2000, 120), day(week[1], 1990, 120), day(week[2], 2010, 120)), goals, balance: true });
  check('on track: today stays at goal', dayOf(plan, week[3])!.target === G, String(dayOf(plan, week[3])!.target));
  check('on track: message', weekMessage(plan).tone === 'good', weekMessage(plan).text);
}

// 2. 1,000 over on Sunday spreads over the six days after it.
{
  const plan = planWeek({ today: week[1], logs: logs(day(week[0], 3000)), goals, balance: true });
  const today = dayOf(plan, week[1])!;
  check('over: Monday is lighter', today.target === 1830, String(today.target)); // 2000 − 1000/6 ≈ 1833 → 1830
  check('over: every later day is lighter too', plan.days.slice(2).every(d => d.target === 1830 || d.target === 1840),
    plan.days.map(d => d.target).join(','));
  check('over: week lands near budget', Math.abs(plan.projectedDifference) <= 30, String(plan.projectedDifference));
  check('over: carry reported', plan.carry === 1000, String(plan.carry));
  check('over: message mentions lighter', /lighter/.test(weekMessage(plan).text), weekMessage(plan).text);
}

// 3. A huge overshoot never plans a day below the safe floor.
{
  const plan = planWeek({ today: week[1], logs: logs(day(week[0], 7000)), goals, sex: 'female', balance: true });
  const targets = plan.days.slice(1).map(d => d.target);
  check('floor: no day below 85% of goal', targets.every(t => t >= 1700), targets.join(','));
  check('floor: limited flagged', dayOf(plan, week[1])!.limited);
  check('floor: message admits the week runs over', weekMessage(plan).tone === 'warning', weekMessage(plan).text);
  const small = planWeek({ today: week[1], logs: logs(day(week[0], 5000)), goals: { calories: 1300, protein: 80 }, sex: 'female', balance: true });
  check('floor: never under 1,200', small.days.slice(1).every(d => d.target >= 1200), small.days.map(d => d.target).join(','));
  const male = planWeek({ today: week[1], logs: logs(day(week[0], 5000)), goals: { calories: 1700, protein: 100 }, sex: 'male', balance: true });
  check('floor: never under 1,500 for men', male.days.slice(1).every(d => d.target >= 1500), male.days.map(d => d.target).join(','));
}

// 4. Eating less earlier raises later days, but only so far.
{
  const plan = planWeek({ today: week[4], logs: logs(day(week[0], 1200), day(week[1], 1200), day(week[2], 1200), day(week[3], 1200)), goals, balance: true });
  const t = dayOf(plan, week[4])!.target;
  check('under: later days get more', t > G, String(t));
  check('under: but never over 115%', t <= 2300, String(t));
}

// 5. Days with nothing (or almost nothing) logged don't create a surplus.
{
  const plan = planWeek({ today: week[3], logs: logs(day(week[1], 300)), goals, balance: true });
  check('unlogged: today stays at goal', dayOf(plan, week[3])!.target === G, String(dayOf(plan, week[3])!.target));
  check('unlogged: basis assumed', dayOf(plan, week[0])!.basis === 'assumed');
  check('incomplete: basis incomplete', dayOf(plan, week[1])!.basis === 'incomplete');
}

// 6. A day's target only depends on the days before it, so it doesn't
// shift while you eat.
{
  const before = planWeek({ today: week[2], logs: logs(day(week[0], 2600)), goals, balance: true });
  const after = planWeek({ today: week[2], logs: logs(day(week[0], 2600), day(week[2], 2900)), goals, balance: true });
  check('stable: today target unchanged by today\'s food', dayOf(before, week[2])!.target === dayOf(after, week[2])!.target);
  check('stable: tomorrow absorbs today\'s overage', dayOf(after, week[3])!.target < dayOf(before, week[3])!.target,
    `${dayOf(before, week[3])!.target} → ${dayOf(after, week[3])!.target}`);
}

// 7. Protein: behind for the week → higher daily protein, never below goal.
{
  const plan = planWeek({ today: week[3], logs: logs(day(week[0], 2000, 60), day(week[1], 2000, 60), day(week[2], 2000, 60)), goals, balance: true });
  const p = dayOf(plan, week[3])!.proteinTarget;
  check('protein: catches up', p > P && p <= 156, String(p));
  const ahead = planWeek({ today: week[3], logs: logs(day(week[0], 2000, 200)), goals, balance: true });
  check('protein: never below daily goal', ahead.days.every(d => d.proteinTarget >= P));
}

// 8. Balancing off → every day is the plain goal.
{
  const plan = planWeek({ today: week[1], logs: logs(day(week[0], 3500)), goals, balance: false });
  check('off: plain targets', plan.days.every(d => d.target === G && d.proteinTarget === P));
}

// 9. Meals: big breakfast and lunch → a smaller dinner, never a skipped one.
{
  const plan = planWeek({ today: week[0], logs: new Map(), goals, balance: true });
  const today = dayOf(plan, week[0])!;
  const eaten = day(week[0], 1500, 80, {
    breakfast: { calories: 700, protein: 30, items: 2 },
    lunch: { calories: 800, protein: 50, items: 2 },
  });
  const meals = planMeals({ day: today, log: eaten, nowMinutes: 14 * 60, slots: STANDARD });
  const dinner = meals.find(m => m.meal === 'dinner')!;
  check('meals: dinner gets what is left', dinner.state === 'planned' && dinner.calories === 500, `${dinner.calories}`);
  check('meals: dinner marked lighter', dinner.size === 'lighter');
  check('meals: dinner carries the protein still needed', dinner.protein >= 30, String(dinner.protein));
  check('meals: no room for a snack', meals.find(m => m.meal === 'snack')!.state === 'optional');

  const over = day(week[0], 2400, 90, { breakfast: { calories: 1100, protein: 40, items: 2 }, lunch: { calories: 1300, protein: 50, items: 2 } });
  const overMeals = planMeals({ day: today, log: over, nowMinutes: 15 * 60, slots: STANDARD });
  check('meals: already over → a light dinner, not none', overMeals.find(m => m.meal === 'dinner')!.calories === 400);
}

// 10. A skipped breakfast moves its share to later meals; no meal balloons.
{
  const plan = planWeek({ today: week[0], logs: new Map(), goals, balance: true });
  const meals = planMeals({ day: dayOf(plan, week[0])!, log: undefined, nowMinutes: 13 * 60, slots: STANDARD });
  check('skip: breakfast skipped after its window', meals[0].state === 'skipped');
  const planned = meals.filter(m => m.state === 'planned');
  const total = planned.reduce((s, m) => s + m.calories, 0);
  check('skip: rest of day still adds up', Math.abs(total - G) <= 30, String(total));
  check('skip: no meal over 45% of the day', planned.every(m => m.calories <= 0.45 * G + 10), planned.map(m => m.calories).join(','));

  const late = planMeals({ day: dayOf(plan, week[0])!, log: undefined, nowMinutes: 19 * 60, slots: STANDARD });
  const dinner = late.find(m => m.meal === 'dinner')!;
  check('late: nothing eaten by 7 pm doesn\'t mean a 2,000 cal dinner', dinner.calories <= 900, String(dinner.calories));
}

// 11. Learned meal sizes follow the user's habits.
{
  const history = Array.from({ length: 10 }, (_, i) => day(addDays(SUNDAY, -i - 1), 2000, 100, {
    breakfast: { calories: 800, protein: 40, items: 1 },
    lunch: { calories: 800, protein: 40, items: 1 },
    dinner: { calories: 400, protein: 20, items: 1 },
  }));
  const shares = learnMealShares(history, G);
  check('shares: learns a big breakfast', shares.breakfast > 0.33 && shares.dinner < 0.25, JSON.stringify(shares));
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  check('shares: sum to 1', Math.abs(sum - 1) < 1e-9);
  check('shares: defaults with no history', learnMealShares([], G).lunch === DEFAULT_SHARES.lunch);
}


// 15. Eating schedules.
{
  const plan = planWeek({ today: week[0], logs: new Map(), goals, balance: true });
  const today = dayOf(plan, week[0])!;
  const schedule = (kind: EatingSchedule['kind'], window = DEFAULT_SCHEDULE.window): EatingSchedule => ({ kind, window });

  const noBreakfast = planMeals({ day: today, nowMinutes: 9 * 60, slots: mealSlots(schedule('no-breakfast'), week[0]) });
  check('no breakfast: no breakfast planned', !noBreakfast.some(m => m.meal === 'breakfast'), noBreakfast.map(m => m.meal).join(','));
  const nbTotal = noBreakfast.filter(m => m.state === 'planned').reduce((sum, m) => sum + m.calories, 0);
  check('no breakfast: lunch and dinner carry the day', Math.abs(nbTotal - G) <= 30, String(nbTotal));

  const omad = planMeals({ day: today, nowMinutes: 10 * 60, slots: mealSlots(schedule('omad'), week[0]) });
  check('one meal: a single meal', omad.length === 1 && omad[0].label === 'Meal', omad.map(m => m.label).join(','));
  check('one meal: it holds the whole day', omad[0].calories === G, String(omad[0].calories));
  check('one meal: protein not capped at 60 g', omad[0].protein >= P - 5, String(omad[0].protein));

  const window = planMeals({ day: today, nowMinutes: 9 * 60, slots: mealSlots(schedule('window', { start: 12 * 60, end: 20 * 60 }), week[0]) });
  check('window: labelled first and last meal', window.map(m => m.label).join(',') === 'First meal,Last meal,Snacks', window.map(m => m.label).join(','));
  const windowLate = planMeals({ day: today, nowMinutes: 20 * 60 + 30, slots: mealSlots(schedule('window', { start: 12 * 60, end: 20 * 60 }), week[0]) });
  check('window: nothing planned after the window closes', windowLate.every(m => m.state !== 'planned'), windowLate.map(m => `${m.label}:${m.state}`).join(','));

  // Ramadan 2026 begins around Feb 18. Durham sunset that day is about 6:00 pm.
  const ramadanDay = '2026-02-18';
  const times = fastingTimes(ramadanDay);
  check('fasting: sunset in Durham about 6 pm', times.maghrib >= 17 * 60 + 55 && times.maghrib <= 18 * 60 + 5, String(times.maghrib));
  check('fasting: dawn well before sunrise', times.fajr >= 5 * 60 + 30 && times.fajr <= 6 * 60, String(times.fajr));
  const summer = fastingTimes('2026-06-21');
  check('fasting: long summer day', summer.maghrib - summer.fajr > 15 * 60, `${summer.fajr}-${summer.maghrib}`);
  const ramadan = mealSlots(schedule('ramadan'), ramadanDay);
  check('fasting: suhoor ends at dawn', ramadan.find(s => s.label === 'Suhoor')!.end === times.fajr);
  check('fasting: iftar starts at sunset', ramadan.find(s => s.label === 'Iftar')!.start === times.maghrib);
  const afternoon = planMeals({ day: today, nowMinutes: 15 * 60, slots: ramadan });
  check('fasting: in the afternoon suhoor has passed', afternoon.find(m => m.label === 'Suhoor')!.state === 'skipped');
  const iftar = afternoon.find(m => m.label === 'Iftar')!;
  check('fasting: iftar gets most of the day', iftar.state === 'planned' && iftar.calories >= 0.6 * G, String(iftar.calories));
  check('fasting: default meal at 3 pm is iftar', mealAt(ramadan, 15 * 60) === 'dinner');
  check('fasting: default meal at 4 am is suhoor', mealAt(ramadan, 4 * 60 + 30) === 'breakfast');
  check('standard: default meal mid-morning is breakfast', mealAt(STANDARD, 10 * 60) === 'breakfast');
  check('standard: default meal at 4:30 pm is a snack', mealAt(STANDARD, 16 * 60 + 30) === 'snack');
  check('one meal: default meal is the meal', mealAt(mealSlots(schedule('omad'), week[0]), 8 * 60) === 'dinner');

  // A meal logged outside the schedule still shows (a breakfast during Ramadan).
  const logged = planMeals({ day: today, log: day(week[0], 500, 20, { lunch: { calories: 500, protein: 20, items: 1 } }), nowMinutes: 15 * 60, slots: ramadan });
  check('fasting: an off-schedule meal still shows', logged.some(m => m.meal === 'lunch' && m.state === 'eaten'));
}

// 16. Dietary marks.
{
  const label = (extra: Partial<{ contains: string[]; diet: string[]; halal: boolean }>) =>
    ({ name: 'x', serving_size: null, calories: 100, halal: false, last_seen: '2026-10-01', ...extra });
  const kitchen = { allergen_info: true, diet_info: true };
  const veg = dietaryOf([label({ diet: ['vegetarian'] }), label({ diet: ['vegan', 'vegetarian'], contains: ['soy'] })], kitchen);
  check('diet: vegetarian when every part is', veg.vegetarian && !veg.vegan);
  check('diet: allergens are the union', veg.contains.join(',') === 'soy', veg.contains.join(','));
  const mixed = dietaryOf([label({ diet: ['vegetarian'] }), label({})], kitchen);
  check('diet: one unmarked part makes it unknown', !mixed.vegetarian);
  const vegPrefs: FoodPreferences = { ...NO_PREFERENCES, diet: 'vegetarian' };
  check('diet: vegetarian dish fits a vegetarian', checkPreferences(veg, vegPrefs).fits);
  const peanut: FoodPreferences = { ...NO_PREFERENCES, avoid: ['peanut'] };
  check('allergy: unmarked dish at a kitchen that marks allergens fits', checkPreferences(veg, peanut).fits);
  const noInfo = dietaryOf([label({})], { allergen_info: false, diet_info: false });
  const noInfoCheck = checkPreferences(noInfo, peanut);
  check('allergy: a kitchen without allergen info is never vouched for', !noInfoCheck.fits && noInfoCheck.unknown.includes('allergens'));
  const soyCheck = checkPreferences(veg, { ...NO_PREFERENCES, avoid: ['soy'] });
  check('allergy: a marked allergen is a conflict', !soyCheck.fits && soyCheck.conflicts.join() === 'soy');
  const halalDish = dietaryOf([label({ halal: true }), label({ diet: ['vegetarian'] })], kitchen);
  check('halal: halal meat with vegetarian sides fits', checkPreferences(halalDish, { ...NO_PREFERENCES, halal: true }).fits);
  check('halal: unmarked meat does not', !checkPreferences(dietaryOf([label({})], kitchen), { ...NO_PREFERENCES, halal: true }).fits);

  // Labels missing their icons: names add caution, never remove it.
  const milkFree: FoodPreferences = { ...NO_PREFERENCES, avoid: ['milk'] };
  const unmarked = (name: string) => dietaryOf([label({ name } as never)], kitchen, false, [name]);
  for (const name of ['Turkey w Provolone Ciabatta', 'Milk 2% Glass', 'Tuna Melt on Wheat', 'Chicken Alfredo', 'Iced Latte']) {
    const check1 = checkPreferences(unmarked(name), milkFree);
    check(`names: "${name}" is not offered to someone avoiding milk`, !check1.fits && check1.possible.includes('milk'), JSON.stringify(check1));
  }
  check('names: shrimp means shellfish', unmarked('Blackened Shrimp Tacos').mayContain.includes('shellfish'));
  check('names: gluten-free bread is not flagged for gluten', !unmarked('Gluten-Free Bread').mayContain.includes('gluten'));
  const markedVeg = (name: string) => dietaryOf([label({ name, diet: ['vegetarian', 'vegan'] } as never)], kitchen, false, [name]);
  check('names: a marked-vegetarian chicken dish is not vegetarian', !markedVeg('Chicken Caesar Wrap').vegetarian);
  check('names: a plant-based burger stays vegetarian', markedVeg('Nadura Vegan Burger on Bun').vegetarian);
  check('names: a cheese dish marked vegan is not vegan', !markedVeg('Cheese Pizza').vegan);
  check('names: "Contains: Dairy" in a description means milk',
    dietaryOf([label({})], kitchen, false, ['Cobb Salad', 'Monterey Jack (GF)(Contains: Dairy Eggs)']).mayContain.includes('milk'));
  check('names: dairy-free is not flagged for milk', !unmarked('Dairy-Free Chocolate Shake').mayContain.includes('milk'));
  check('names: vegan cheese is not flagged for milk', !unmarked('Vegan Mac and Cheese').mayContain.includes('milk'));
  const vegan = dietaryOf([label({ diet: ['vegan', 'vegetarian'] }), label({ diet: ['vegan', 'vegetarian'] })], kitchen, false, ['Nadura Vegan Burger', 'Bacon']);
  check('names: bacon on a vegan burger is not vegetarian', !vegan.vegetarian);
  check('names: cheddar added to a vegan burger still flags milk',
    dietaryOf([label({}), label({})], kitchen, false, ['Vegan Burger', 'Cheddar']).mayContain.includes('milk'));
}

// 12. Categories.
check('category: condiments are components', categorize('Condiments', 'Ketchup') === 'component');
check('category: veggie burger is not breakfast', categorize('Burgers', 'Veggie Burger') === 'main');
check('category: crab cake is not dessert', categorize('Sandwiches', 'Crab Cake Sandwich') === 'main');
check('category: salads are mains', categorize('Soups and Salads', 'Caesar Salad') === 'main');
check('category: lattes are drinks', categorize('Espresso Bar', 'Latte') === 'drink');

// 13. Opening hours.
{
  const hours = { Monday: [['07:00', '21:00']] as [string, string][], Tuesday: [['00:00', '03:00'], ['07:00', '23:59']] as [string, string][] };
  check('hours: open at lunch', openDuring(hours, 1, 11 * 60, 16 * 60));
  check('hours: closed at 10 pm', !openDuring(hours, 1, 22 * 60, 23 * 60));
  check('hours: closed on an unlisted day', !openDuring(hours, 3, 11 * 60, 14 * 60));
  check('hours: midnight close counts', openDuring(hours, 2, 22 * 60, 24 * 60));
}

// 14. Suggestions from the real menus.
const root = path.resolve(__dirname, '..', '..', 'assets', 'menu');
const index: MenuIndex = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const restaurants = index.restaurants.map(summary => ({
  menu: JSON.parse(fs.readFileSync(path.join(root, 'restaurants', summary.file), 'utf8')) as RestaurantMenu,
  hours: summary.hours,
}));
const pool = buildMenuPool(restaurants);
check('pool: has hundreds of dishes', pool.length > 300, String(pool.length));
check('pool: no components', pool.every(o => !/condiment|topping|dressing/i.test(o.section)));
check('pool: only fully known nutrition', pool.every(o => o.calories >= 30 && Number.isFinite(o.protein)));

const saved: SavedFood[] = [
  { id: 's1', name: 'Protein shake', restaurant: 'Custom Meal', calories: 250, protein: 30, type: 'custom', useCount: 4 },
  { id: 's2', name: 'Mystery bowl', restaurant: 'Custom Meal', calories: 500, protein: 20, type: 'custom', useCount: 1, nutrition_status: 'none' },
];
const savedPool = buildSavedPool(saved, pool);
check('saved: foods without nutrition are never suggested', !savedPool.some(o => o.name === 'Mystery bowl'));
const allFoods = [...pool, ...savedPool];
const familiar = familiarityMap(saved);

const scenarios: { meal: MealType; calories: number; protein: number; date: string; label: string }[] = [
  { meal: 'breakfast', calories: 500, protein: 25, date: '2026-10-05', label: 'Monday breakfast' },
  { meal: 'lunch', calories: 700, protein: 40, date: '2026-10-07', label: 'Wednesday lunch' },
  { meal: 'dinner', calories: 450, protein: 35, date: '2026-10-07', label: 'light dinner' },
  { meal: 'dinner', calories: 900, protein: 50, date: '2026-10-10', label: 'big Saturday dinner' },
  { meal: 'snack', calories: 250, protein: 10, date: '2026-10-08', label: 'snack' },
];
for (const s of scenarios) {
  const window = mealWindow(slotWindow(s.meal), null);
  const results = recommend({ pool: allFoods, meal: s.meal, calories: s.calories, protein: s.protein, date: s.date, window, familiar, limit: 5 });
  const weekday = new Date(`${s.date}T12:00:00`).getDay();
  check(`${s.label}: at least 3 suggestions`, results.length >= 3, String(results.length));
  for (const r of results) {
    const where = `${s.label}: ${r.parts.map(p => `${p.name} (${p.restaurantName}, ${p.section || 'saved'})`).join(' + ')} ${r.calories} cal ${r.protein} g`;
    check(`${s.label}: near the calorie target`, r.calories >= s.calories * 0.55 && r.calories <= s.calories * 1.2, where);
    for (const part of r.parts) {
      check(`${s.label}: open at that time`, !part.hoursKnown || part.source === 'saved' && !part.restaurantId
        || openDuring(part.hours, weekday, window.from, window.to), where);
      check(`${s.label}: weekday specials only on their day`, part.weekday === null || part.weekday === weekday, where);
      check(`${s.label}: no Marine Lab for a main-campus user`, part.restaurantId !== 'duke-marine-lab', where);
    }
  }
  for (const r of results.filter(r => r.parts.length === 2)) {
    check(`${s.label}: pairs are a dish plus a side, drink or saved meal`,
      (r.parts[0].category === 'main' || r.parts[0].category === 'breakfast')
      && (['side', 'drink', 'smoothie'].includes(r.parts[1].category) || r.parts[1].source === 'saved'),
      r.parts.map(p => `${p.name}:${p.category}`).join(' + '));
  }
  const places = results.map(r => r.parts[0].restaurantId ?? 'mine');
  check(`${s.label}: varied restaurants`, new Set(places.slice(0, 3)).size === Math.min(3, places.length), places.join(','));
  console.log(`\n${s.label} (${s.calories} cal, ${s.protein} g protein):`);
  for (const r of results) {
    console.log(`  ${r.approx ? '~' : ''}${r.calories} cal ${r.protein} g  ${r.parts.map(p => `${p.name} [${p.restaurantName}]`).join(' + ')}  ${r.tags.join(' ')}`);
  }
}
const tiny = recommend({ pool: allFoods, meal: 'snack', calories: 80, protein: 0, date: '2026-10-08', window: mealWindow(slotWindow('snack'), null), familiar });
check('tiny budget: no suggestions', tiny.length === 0);
const lateTonight = recommend({ pool: allFoods, meal: 'dinner', calories: 600, protein: 30, date: '2026-10-07', window: mealWindow(slotWindow('dinner'), 21 * 60 + 45), familiar });
check('late: only places still open', lateTonight.every(r => r.parts.every(p => !p.hoursKnown || !p.restaurantId || openDuring(p.hours, 3, 21 * 60 + 45, 22 * 60 + 45))));


// 17. Suggestions respect dietary preferences, using the real menu marks.
{
  const menusById = new Map(restaurants.map(r => [r.menu.id, r.menu]));
  const cases: { label: string; prefs: FoodPreferences; meal: MealType; calories: number }[] = [
    { label: 'vegetarian lunch', prefs: { ...NO_PREFERENCES, diet: 'vegetarian' }, meal: 'lunch', calories: 650 },
    { label: 'vegan dinner', prefs: { ...NO_PREFERENCES, diet: 'vegan' }, meal: 'dinner', calories: 600 },
    { label: 'halal dinner', prefs: { ...NO_PREFERENCES, halal: true }, meal: 'dinner', calories: 700 },
    { label: 'peanut and milk allergy lunch', prefs: { ...NO_PREFERENCES, avoid: ['peanut', 'milk'] }, meal: 'lunch', calories: 650 },
  ];
  for (const c of cases) {
    const results = recommend({
      pool: allFoods, meal: c.meal, calories: c.calories, protein: 30, date: '2026-10-07',
      window: mealWindow(slotWindow(c.meal), null), familiar, limit: 5, prefs: c.prefs,
    });
    check(`${c.label}: has suggestions`, results.length >= 2, String(results.length));
    for (const r of results) {
      for (const part of r.parts) {
        if (part.source === 'saved' && !part.restaurantId) continue; // the user's own meal
        const menu = menusById.get(part.restaurantId!)!;
        const item = menu.sections.flatMap(sec => sec.items).find(i => i.id === part.itemId)!;
        const fit = checkPreferences(dishDietary(menu, item), c.prefs);
        check(`${c.label}: every dish is marked as fitting`, fit.fits, `${part.name} (${part.restaurantName}) ${JSON.stringify(fit)}`);
      }
    }
    console.log(`\n${c.label}:`);
    for (const r of results) console.log(`  ${r.calories} cal ${r.protein} g  ${r.parts.map(p => `${p.name} [${p.restaurantName}]`).join(' + ')}`);
  }

  // One meal a day: around 2,000 cal from two dishes at one place.
  const big = recommend({ pool: allFoods, meal: 'dinner', calories: 2000, protein: 110, date: '2026-10-07', window: { from: 11 * 60, to: 22 * 60 }, familiar, limit: 5 });
  check('one meal: suggestions for a 2,000 cal meal', big.length >= 3, String(big.length));
  check('one meal: each lands near 2,000 cal', big.every(r => r.calories >= 1600 && r.calories <= 2240), big.map(r => r.calories).join(','));
  console.log('\none meal a day (2,000 cal):');
  for (const r of big) console.log(`  ${r.calories} cal ${r.protein} g  ${r.parts.map(p => `${p.name} [${p.restaurantName}]`).join(' + ')}`);

  // Suhoor picked up the evening before: places open 7 pm - midnight the day before.
  const suhoor = recommend({ pool: allFoods, meal: 'breakfast', calories: 600, protein: 30, date: '2026-02-17', window: { from: 19 * 60, to: 24 * 60 }, familiar, limit: 4 });
  check('suhoor: something to pick up the night before', suhoor.length >= 2, String(suhoor.length));
}

console.log(`\n${passes} checks passed, ${failures.length} failed.`);
if (failures.length) {
  failures.forEach(f => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('All planner checks passed.');

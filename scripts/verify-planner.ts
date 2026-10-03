// Checks the weekly meal planner: week balancing, meal splits and food
// suggestions against the bundled menus.
//
//   npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-planner.js
import * as fs from 'fs';
import * as path from 'path';
import { addDays, weekOf } from '../services/dates';
import type { MealType } from '../services/meals';
import type { MenuIndex, RestaurantMenu } from '../services/menuTypes';
import {
  buildMenuPool, buildSavedPool, categorize, dayOf, familiarityMap, learnMealShares, LoggedDay, mealWindow,
  openDuring, planMeals, planWeek, recommend, SavedFood, weekMessage, DEFAULT_SHARES,
} from '../services/planner';

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
  const meals = planMeals({ day: today, log: eaten, nowMinutes: 14 * 60, shares: DEFAULT_SHARES });
  const dinner = meals.find(m => m.meal === 'dinner')!;
  check('meals: dinner gets what is left', dinner.state === 'planned' && dinner.calories === 500, `${dinner.calories}`);
  check('meals: dinner marked lighter', dinner.size === 'lighter');
  check('meals: dinner carries the protein still needed', dinner.protein >= 30, String(dinner.protein));
  check('meals: no room for a snack', meals.find(m => m.meal === 'snack')!.state === 'optional');

  const over = day(week[0], 2400, 90, { breakfast: { calories: 1100, protein: 40, items: 2 }, lunch: { calories: 1300, protein: 50, items: 2 } });
  const overMeals = planMeals({ day: today, log: over, nowMinutes: 15 * 60, shares: DEFAULT_SHARES });
  check('meals: already over → a light dinner, not none', overMeals.find(m => m.meal === 'dinner')!.calories === 400);
}

// 10. A skipped breakfast moves its share to later meals; no meal balloons.
{
  const plan = planWeek({ today: week[0], logs: new Map(), goals, balance: true });
  const meals = planMeals({ day: dayOf(plan, week[0])!, log: undefined, nowMinutes: 13 * 60, shares: DEFAULT_SHARES });
  check('skip: breakfast skipped after its window', meals[0].state === 'skipped');
  const planned = meals.filter(m => m.state === 'planned');
  const total = planned.reduce((s, m) => s + m.calories, 0);
  check('skip: rest of day still adds up', Math.abs(total - G) <= 30, String(total));
  check('skip: no meal over 45% of the day', planned.every(m => m.calories <= 0.45 * G + 10), planned.map(m => m.calories).join(','));

  const late = planMeals({ day: dayOf(plan, week[0])!, log: undefined, nowMinutes: 19 * 60, shares: DEFAULT_SHARES });
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
  const window = mealWindow(s.meal, null);
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
const tiny = recommend({ pool: allFoods, meal: 'snack', calories: 80, protein: 0, date: '2026-10-08', window: mealWindow('snack', null), familiar });
check('tiny budget: no suggestions', tiny.length === 0);
const lateTonight = recommend({ pool: allFoods, meal: 'dinner', calories: 600, protein: 30, date: '2026-10-07', window: mealWindow('dinner', 21 * 60 + 45), familiar });
check('late: only places still open', lateTonight.every(r => r.parts.every(p => !p.hoursKnown || !p.restaurantId || openDuring(p.hours, 3, 21 * 60 + 45, 22 * 60 + 45))));

console.log(`\n${passes} checks passed, ${failures.length} failed.`);
if (failures.length) {
  failures.forEach(f => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('All planner checks passed.');

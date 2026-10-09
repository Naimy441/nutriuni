// Checks the bundled menu data against the app's own nutrition engine:
// every reference resolves, every default order computes to a plausible
// number, and a set of hand-worked orders produce the expected totals.
//
//   npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-menu-data.js
import * as fs from 'fs';
import * as path from 'path';
import {
  computeNutrition, defaultSelection, hasNutritionSource, implicitAddFood, prepareLabel, previewNutrition, Selection,
  setValueQuantity, toggleValue, unmetChoices,
} from '../services/menuNutrition';
import type { MenuIndex, MenuItem, RestaurantMenu } from '../services/menuTypes';

const root = path.resolve(__dirname, '..', '..', 'assets', 'menu');
const index: MenuIndex = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const menus = new Map<string, RestaurantMenu>();
for (const summary of index.restaurants) {
  menus.set(summary.id, JSON.parse(fs.readFileSync(path.join(root, 'restaurants', summary.file), 'utf8')));
}

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

// 1. Structural invariants.
let items = 0;
const statuses: Record<string, number> = { complete: 0, partial: 0, none: 0, needsChoice: 0 };
for (const [id, menu] of menus) {
  const seen = new Set<string>();
  const ref = (food: string | undefined, where: string) => {
    if (food && !menu.foods[food]) fail(`${id}: ${where} references missing food ${food}`);
  };
  for (const section of menu.sections) {
    for (const item of section.items) {
      items++;
      if (seen.has(item.id)) fail(`${id}: duplicate item id ${item.id}`);
      seen.add(item.id);
      ref(item.base, item.name);
      item.components?.forEach(c => ref(c, `${item.name} component`));
      item.variants?.forEach(v => ref(v.food, `${item.name} variant`));
      item.options?.forEach(group => {
        if (group.max === 1 && group.values.filter(v => v.default).length > 1) {
          fail(`${id}: ${item.name} / ${group.name} has several defaults in a single-choice group`);
        }
        group.values.forEach(value => ref(value.food, `${item.name} / ${value.name}`));
      });

      // 2. Default orders compute to plausible numbers.
      const preview = previewNutrition(menu, item);
      if (hasNutritionSource(item) && unmetChoices(item, defaultSelection(item)).length) statuses.needsChoice++;
      statuses[preview.status]++;
      if (preview.totals) {
        const { calories, protein, carbs, fat } = preview.totals;
        if (calories < 0 || calories > 3000) fail(`${id}: ${item.name} defaults to ${calories} kcal`);
        if ([protein, carbs, fat].some(n => n < 0 || n > 400)) fail(`${id}: ${item.name} has implausible macros`);
      } else if (preview.status !== 'none') {
        fail(`${id}: ${item.name} status ${preview.status} without totals`);
      }
      if (!hasNutritionSource(item) && preview.status !== 'none') fail(`${id}: ${item.name} has nutrition without a source`);
    }
  }
  const counted = menu.sections.reduce((sum, s) => sum + s.items.filter(hasNutritionSource).length, 0);
  if (counted !== menu.stats.with_nutrition) fail(`${id}: stats say ${menu.stats.with_nutrition} items with nutrition, found ${counted}`);
}

// 3. Hand-worked orders. Expected values come straight from the labels.
function find(restaurantId: string, itemName: string): { menu: RestaurantMenu; item: MenuItem } {
  const menu = menus.get(restaurantId);
  const item = menu?.sections.flatMap(s => s.items).find(i => i.name === itemName);
  if (!menu || !item) throw new Error(`missing ${restaurantId} / ${itemName}`);
  return { menu, item };
}
function choose(item: MenuItem, selection: Selection, ...names: string[]): Selection {
  for (const name of names) {
    const g = (item.options ?? []).findIndex(group => group.values.some(v => v.name === name && !selection[(item.options ?? []).indexOf(group)][group.values.indexOf(v)]));
    if (g < 0) throw new Error(`${item.name}: no unselected option ${name}`);
    selection = toggleValue(item, selection, g, item.options![g].values.findIndex(v => v.name === name && !selection[g][item.options![g].values.indexOf(v)]));
  }
  return selection;
}
function label(menu: RestaurantMenu, name: string, serving?: string): number {
  const food = Object.values(menu.foods).find(f => f.name === name && (!serving || f.serving_size?.includes(serving)));
  if (!food) throw new Error(`no label ${name}`);
  return food.calories;
}
function expect(title: string, actual: number | undefined, expected: number, status?: string, actualStatus?: string) {
  const ok = actual === expected && (!status || status === actualStatus);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}: ${actual} kcal${actualStatus ? ` (${actualStatus})` : ''}, expected ${expected}${status ? ` (${status})` : ''}`);
  if (!ok) fail(title);
}

{
  const { menu, item } = find('tandoor', 'Monday Non-Vegetarian Combo');
  let sel = choose(item, defaultSelection(item), 'Chicken Tikka Masala', 'Chicken 65', 'Chana Masala');
  const base = label(menu, 'Basmati Rice Pilaf') + label(menu, 'Naan');
  const curries = label(menu, 'Chicken Tikka Masala') + label(menu, 'Chicken 65') + label(menu, 'Chana Masala');
  let r = computeNutrition(menu, item, sel);
  expect('Tandoor combo: rice + naan + 2 proteins + 1 veg', r.totals?.calories, base + curries, 'complete', r.status);
  sel = choose(item, sel, 'No Naan');
  r = computeNutrition(menu, item, sel);
  expect('Tandoor combo with "No Naan" subtracts the naan', r.totals?.calories, base + curries - label(menu, 'Naan'));
}
{
  const { menu, item } = find('beyu-blue', 'Latte');
  expect('Beyu Blue latte defaults to whole milk', previewNutrition(menu, item).totals?.calories, label(menu, 'Latte Whole Milk'));
  let sel = choose(item, defaultSelection(item), 'Oat Milk');
  expect('Beyu Blue latte with oat milk', computeNutrition(menu, item, sel).totals?.calories, label(menu, 'Latte Oat Milk'));
  sel = choose(item, sel, 'Iced');
  expect('Beyu Blue iced oat latte', computeNutrition(menu, item, sel).totals?.calories, label(menu, 'Iced Latte Oat Milk'));
}
{
  // Mobile Order defaults to Large; NetNutrition only labels a small whole-milk latte.
  const { menu, item } = find('cafe', 'Cafe Latte');
  const preview = previewNutrition(menu, item);
  expect('Cafe large latte falls back to the small label', preview.totals?.calories, label(menu, 'Cafe Latte Whole Milk', 'Small'));
  if (!preview.estimated) fail('a size mismatch should be flagged as an estimate');
  let sel = choose(item, defaultSelection(item), 'Small');
  let r = computeNutrition(menu, item, sel);
  expect('Cafe small latte uses the small label exactly', r.totals?.calories, label(menu, 'Cafe Latte Whole Milk', 'Small'));
  if (r.estimated) fail('small latte with a small label is not an estimate');
  sel = choose(item, sel, 'Oat Milk');
  expect('Cafe small oat latte', computeNutrition(menu, item, sel).totals?.calories, label(menu, 'Cafe Latte Oat Milk', 'Small'));
}
{
  const { menu, item } = find('gothic-grill', 'The NC Burger');
  const burger = label(menu, 'NC Burger');
  const preview = previewNutrition(menu, item);
  expect('Gothic NC Burger with default chips (no chips label)', preview.totals?.calories, burger, 'partial', preview.status);
  let sel = defaultSelection(item);
  sel = choose(item, sel, 'Fries');
  const r = computeNutrition(menu, item, sel);
  expect('Gothic NC Burger with fries', r.totals?.calories, burger + label(menu, 'Fresh Cut Fries'), 'complete', r.status);
}
{
  const { menu, item } = find('il-forno', '2 Slices Cheese');
  expect('Il Forno 2 slices = 2 x slice label', previewNutrition(menu, item).totals?.calories, 2 * label(menu, 'Cheese Pizza Slice'));
}
{
  const { menu, item } = find('il-forno', 'Custom Pasta');
  const r = previewNutrition(menu, item);
  const expected = label(menu, 'Fettuccine') + label(menu, 'Alfredo Sauce') + label(menu, 'Chicken', '1.5 oz');
  expect('Il Forno custom pasta defaults (fettuccine + alfredo + chicken)', r.totals?.calories, expected);
  if (!r.estimated) fail('custom pasta should be flagged as an estimate');
}
{
  const { menu, item } = find('marketplace', menus.get('marketplace')!.sections[0].items[0].name);
  expect(`Marketplace "${item.name}" uses its label`, previewNutrition(menu, item).totals?.calories, menu.foods[item.base!].calories);
}
{
  const gothic = ['Build your own Burger', 'Double Patty Melt Burger', 'Gothic Smash Burger', 'The NC Burger', 'Cali Smash Burger'];
  for (const name of gothic) {
    const { menu, item } = find('gothic-grill', name);
    const before = previewNutrition(menu, item).totals?.calories;
    const sel = choose(item, defaultSelection(item), 'Double Burger');
    const doubled = computeNutrition(menu, item, sel);
    expect(`${name}: Double Burger adds a beef patty`, doubled.totals?.calories, (before ?? 0) + 160);
    const group = item.options!.findIndex(g => g.values.some(v => v.name === 'Double Burger'));
    const value = item.options![group].values.findIndex(v => v.name === 'Double Burger');
    const twice = computeNutrition(menu, item, setValueQuantity(item, sel, group, value, 2));
    expect(`${name}: two Double Burgers add two patties`, twice.totals?.calories, (before ?? 0) + 320);
  }
  const krafthouse = ["Mushroom and Swiss Burger", "Devils Krafthouse Burger", "Brecky Burger", "Queso Burger", "Brie and Bacon Jam Burger", "BBQ Bacon Burger", "Build Your Own Burger"];
  for (const name of krafthouse) {
    const { menu, item } = find('the-devil-s-krafthouse', name);
    const before = previewNutrition(menu, item).totals?.calories ?? 0;
    const sel = choose(item, defaultSelection(item), 'Double Burger');
    const doubled = computeNutrition(menu, item, sel);
    expect(`${name}: Double Burger adds the published patty`, doubled.totals?.calories, before + 160);
    if (!doubled.estimated) fail(`${name}: a borrowed patty label should be an estimate`);
  }
  {
    const { menu, item } = find('pitchfork-s', 'Black Angus Burger');
    const before = previewNutrition(menu, item).totals?.calories ?? 0;
    const sel = choose(item, defaultSelection(item), 'Double Cheese');
    expect('Pitchfork Double Cheese adds a cheddar slice', computeNutrition(menu, item, sel).totals?.calories, before + 80);
    if (!implicitAddFood(menu, { name: 'Double Cheese', kind: 'add' })) fail('Double Cheese should resolve to cheddar');
  }
}
{
  const trinity = menus.get('trinity')!;
  const hotChocolate = Object.values(trinity.foods).find(food => food.name === 'Hot Chocolate Whole Milk' && food.serving_size?.includes('Medium'));
  if (!hotChocolate) fail('missing Trinity medium hot chocolate');
  else {
    const prepared = prepareLabel(hotChocolate);
    expect('Trinity medium hot chocolate keeps its milk protein', prepared.label?.protein, 16);
    if (prepared.label?.calories !== 450) fail('Trinity medium hot chocolate calories should stay 450');
  }
  const soy = Object.values(menus.get('cafe')!.foods).find(food => food.name === 'Hot Chocolate Soy Milk');
  if (!soy || prepareLabel(soy).label !== null) fail('Cafe soy hot chocolate (790 kcal / 161 g sugar in a small cup) should be withheld');
  else console.log('PASS  Cafe soy hot chocolate withheld as implausible');
  const salsa = Object.values(menus.get('it-s-thyme')!.foods).find(food => food.name === 'Mango Salsa');
  if (!salsa) fail('missing mango salsa');
  else {
    const prepared = prepareLabel(salsa);
    if (prepared.label?.sugar != null) fail(`mango salsa sugar should be withheld, got ${prepared.label.sugar}`);
    expect('Mango salsa 132 was sodium, not sugar', prepared.label?.sodium, 132);
  }
}
{
  const { menu, item } = find('mcdonald-s', 'Big Mac');
  const r = previewNutrition(menu, item);
  console.log(`${r.status === 'none' ? 'PASS' : 'FAIL'}  McDonald's has no NetNutrition labels: status ${r.status}`);
  if (r.status !== 'none') fail("McDonald's should have no nutrition");
}

console.log(`\n${menus.size} restaurants, ${items} items. Default orders: ${statuses.complete} complete, ${statuses.partial} partial, ${statuses.none} without nutrition; ${statuses.needsChoice} need a choice first.`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('All checks passed.');

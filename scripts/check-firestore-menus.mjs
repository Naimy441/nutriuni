// Checks the live Firestore menus the way the app sees them (anonymous client
// SDK): the published index matches duke_halal's nutriuni/menus on GitHub,
// every restaurant document matches its version, and the security rules reject
// listing and writes.
//
//   node scripts/check-firestore-menus.mjs
import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, setLogLevel } from 'firebase/firestore/lite';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../constants/firebaseConfig.ts', import.meta.url), 'utf8');
const config = Object.fromEntries([...source.matchAll(/(\w+): "([^"]*)"/g)].map(m => [m[1], m[2]]));
const db = getFirestore(initializeApp(config));
setLogLevel('silent'); // denied requests below are expected
const GITHUB = 'https://raw.githubusercontent.com/Naimy441/Naimy441.github.io/main/nutriuni/menus/index.json';

let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failures++;
};

const meta = (await getDoc(doc(db, 'menu_meta', 'current'))).data();
check(Boolean(meta), 'menu_meta/current is readable');
if (meta) {
  const published = await (await fetch(GITHUB)).text();
  check(meta.index === published, `Firestore index matches GitHub (data version ${meta.generated_at})`);
  const index = JSON.parse(meta.index);
  const docs = await Promise.all(index.restaurants.map(row => getDoc(doc(db, 'menu_restaurants', row.id))));
  const bad = docs.filter((snapshot, i) => {
    const data = snapshot.data();
    const row = index.restaurants[i];
    return !data || data.version !== meta.versions[row.id] || JSON.parse(data.data).id !== row.id
      || Boolean(data.icon) !== Boolean(row.icon);
  });
  check(bad.length === 0, `${docs.length} restaurant documents match their versions${bad.length ? ` (bad: ${bad.map(d => d.id)})` : ''}`);
  const bytes = docs.reduce((sum, d) => sum + d.data().data.length, 0);
  console.log(`      ${(bytes / 1024).toFixed(0)} KB of menu data, published ${meta.published_at?.toDate?.().toISOString?.() ?? ''}`);
}

const denied = async (label, action) => {
  try {
    await action();
    check(false, `${label} should be denied`);
  } catch (error) {
    check(error.code === 'permission-denied', `${label} is denied (${error.code})`);
  }
};
await denied('listing menu_restaurants', () => getDocs(collection(db, 'menu_restaurants')));
await denied('writing a restaurant', () => setDoc(doc(db, 'menu_restaurants', 'gothic-grill'), { data: '{}' }));
await denied('overwriting the index', () => setDoc(doc(db, 'menu_meta', 'current'), { index: '{}' }));
await denied('deleting a restaurant', () => deleteDoc(doc(db, 'menu_restaurants', 'tandoor')));
await denied('reading other collections', () => getDoc(doc(db, 'users', 'anyone')));

process.exit(failures ? 1 : 0);

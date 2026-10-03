// Menu Database Service - Mobile Order menus with NetNutrition labels.
//
// Three layers, newest wins:
//   1. the snapshot bundled with the app (assets/menu, always available offline)
//   2. the last good copy from Firestore, kept in AsyncStorage
//   3. Firestore itself (menu_meta/current + menu_restaurants/{id}), published
//      by the syncMenus Cloud Function from duke_halal's thrice-daily scrape.
// Screens read synchronously from memory; refreshes download only restaurants
// whose version changed, persist them, then swap them in at once and notify.
import { menuIndex as bundledIndex, restaurantFiles, restaurantIcons } from '@/assets/menu/registry';
import { firebaseConfig } from '@/constants/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { hasNutritionSource } from './menuNutrition';
import type { MenuIndex, MenuItem, RestaurantMenu, RestaurantSummary, WeeklyHours } from './menuTypes';

export type { FoodLabel, MenuItem, MenuSection, OptionGroup, OptionValue, RestaurantMenu, RestaurantSummary } from './menuTypes';

export interface ItemSearchResult {
  restaurant: RestaurantSummary;
  section: string;
  item: MenuItem;
}

export type MenuDataSource = 'bundled' | 'cache' | 'remote';

const SUPPORTED_SCHEMA_VERSION = 1;
const CACHE_META_KEY = 'menus:v1:meta';
const CACHE_RESTAURANT_PREFIX = 'menus:v1:r:';
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

interface RemoteMeta {
  schema_version: number;
  generated_at: string;
  index: string;
  versions: Record<string, string>;
}

interface RemoteRestaurant {
  data: string;
  version: string;
  icon: string | null;
}

// What a restaurant entry looks like on disk.
interface CachedRestaurant {
  version: string;
  data: string;
  icon: string | null;
}

interface MenuState {
  index: MenuIndex;
  versions: Record<string, string>;
  // Restaurants whose version differs from the bundled snapshot.
  downloaded: Map<string, { version: string; menu: RestaurantMenu; icon: string | null }>;
  source: MenuDataSource;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minutes(clock: string): number {
  const [hours, mins] = clock.split(':').map(Number);
  return hours * 60 + mins;
}

function formatClock(clock: string): string {
  const [hours, mins] = clock.split(':').map(Number);
  if (hours === 23 && mins === 59) return 'midnight';
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour = hours % 12 || 12;
  return mins ? `${hour}:${String(mins).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

export interface OpenStatus {
  isOpen: boolean | null; // null when hours are unknown
  label: string;
}

// "Open until 10 pm", "Opens at 11 am", "Closed today", from Mobile Order's
// weekly pickup hours.
export function openStatus(hours: WeeklyHours | undefined, now = new Date()): OpenStatus {
  if (!hours || !Object.keys(hours).length) return { isOpen: null, label: '' };
  const current = now.getHours() * 60 + now.getMinutes();
  const today = hours[DAYS[now.getDay()]] ?? [];
  for (const [open, close] of today) {
    if (current >= minutes(open) && current < minutes(close)) {
      return { isOpen: true, label: `Open until ${formatClock(close)}` };
    }
  }
  const later = today.find(([open]) => minutes(open) > current);
  if (later) return { isOpen: false, label: `Opens at ${formatClock(later[0])}` };
  return { isOpen: false, label: today.length ? 'Closed for today' : 'Closed today' };
}

export function todaysHours(hours: WeeklyHours | undefined, now = new Date()): string {
  const today = hours?.[DAYS[now.getDay()]] ?? [];
  return today.map(([open, close]) => `${formatClock(open)} – ${formatClock(close)}`).join(', ');
}

// Dining halls publish free text: "6:30 am - 7:30 am 7:30 am - 11 am Noon - 2 pm".
// Split it into periods, join back-to-back ones: "6:30 – 11 am · Noon – 2 pm".
const TIME = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)|noon|midnight/gi;
export function hoursTextLabel(text: string | undefined): string {
  if (!text?.trim()) return '';
  const times = [...text.matchAll(TIME)].map(match => {
    const word = match[0].toLowerCase();
    if (word === 'noon') return 12 * 60;
    if (word === 'midnight') return 24 * 60;
    const hour = Number(match[1]) % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
    return hour * 60 + Number(match[2] ?? 0);
  });
  if (times.length < 2 || times.length % 2) return text.trim();
  const periods: [number, number][] = [];
  for (let i = 0; i < times.length; i += 2) {
    const last = periods[periods.length - 1];
    if (last && last[1] === times[i]) last[1] = times[i + 1];
    else periods.push([times[i], times[i + 1]]);
  }
  const clock = (value: number, suffix: boolean) => {
    if (value === 12 * 60) return 'Noon';
    if (value === 24 * 60) return 'midnight';
    const hours = Math.floor(value / 60) % 24;
    const label = `${hours % 12 || 12}${value % 60 ? `:${String(value % 60).padStart(2, '0')}` : ''}`;
    return suffix ? `${label} ${hours >= 12 ? 'pm' : 'am'}` : label;
  };
  return periods
    .map(([open, close]) => {
      // "5 – 9 pm" when both ends share am/pm.
      const same = open !== 12 * 60 && close !== 12 * 60 && close !== 24 * 60 && (open >= 720) === (close >= 720);
      return `${clock(open, !same)} – ${clock(close, true)}`;
    })
    .join(' · ');
}

function versionOf(row: Pick<RestaurantSummary, 'hash' | 'icon_hash'>): string {
  return `${row.hash}:${row.icon_hash ?? ''}`;
}

function versionsOf(index: MenuIndex): Record<string, string> {
  return Object.fromEntries(index.restaurants.map(row => [row.id, versionOf(row)]));
}

function parseRestaurant(id: string, data: string): RestaurantMenu {
  const menu = JSON.parse(data) as RestaurantMenu;
  if (menu.id !== id || menu.schema_version !== SUPPORTED_SCHEMA_VERSION || !Array.isArray(menu.sections)) {
    throw new Error(`unexpected menu data for ${id}`);
  }
  return menu;
}

function parseIndex(text: string): MenuIndex {
  const index = JSON.parse(text) as MenuIndex;
  if (index.schema_version !== SUPPORTED_SCHEMA_VERSION || !Array.isArray(index.restaurants) || !index.restaurants.length) {
    throw new Error('unexpected menu index');
  }
  return index;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function logWarning(message: string, error: unknown) {
  if (__DEV__) console.warn(`[menus] ${message}`, error);
}

class MenuDatabaseService {
  private static instance: MenuDatabaseService;
  private state: MenuState = {
    index: bundledIndex,
    versions: versionsOf(bundledIndex),
    downloaded: new Map(),
    source: 'bundled',
  };
  private readonly bundledVersions = versionsOf(bundledIndex);
  private bundledCache = new Map<string, RestaurantMenu>();
  private listeners = new Set<() => void>();
  private revision = 0;
  private started = false;
  private refreshing: Promise<boolean> | null = null;
  private lastRefreshAttempt = 0;

  static getInstance(): MenuDatabaseService {
    if (!MenuDatabaseService.instance) {
      MenuDatabaseService.instance = new MenuDatabaseService();
    }
    return MenuDatabaseService.instance;
  }

  // ---- reading (synchronous, from memory) ----

  get generatedAt(): string {
    return this.state.index.generated_at;
  }

  get source(): MenuDataSource {
    return this.state.source;
  }

  listRestaurants(): RestaurantSummary[] {
    return this.state.index.restaurants;
  }

  getSummary(id: string): RestaurantSummary | undefined {
    return this.state.index.restaurants.find(r => r.id === id || r.name === id);
  }

  // A bundled image module, or a data URI for icons downloaded later.
  icon(id: string): number | { uri: string } | undefined {
    const downloaded = this.state.downloaded.get(id);
    if (downloaded) return downloaded.icon ? { uri: `data:image/jpeg;base64,${downloaded.icon}` } : undefined;
    return restaurantIcons[id];
  }

  // Accepts the restaurant id, or its display name for older links.
  loadRestaurant(idOrName: string): RestaurantMenu | null {
    const id = this.getSummary(idOrName)?.id;
    if (!id) return null;
    const downloaded = this.state.downloaded.get(id);
    if (downloaded) return downloaded.menu;
    let menu = this.bundledCache.get(id);
    if (!menu) {
      menu = restaurantFiles[id]?.();
      if (!menu) return null;
      this.bundledCache.set(id, menu);
    }
    return menu;
  }

  // Dishes across every restaurant whose name (or description) matches.
  searchItems(query: string, limit = 40): ItemSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const results: { result: ItemSearchResult; score: number }[] = [];
    for (const restaurant of this.state.index.restaurants) {
      const menu = this.loadRestaurant(restaurant.id);
      if (!menu) continue;
      for (const section of menu.sections) {
        for (const item of section.items) {
          const name = item.name.toLowerCase();
          const text = `${name} ${section.name.toLowerCase()} ${item.description?.toLowerCase() ?? ''}`;
          if (!terms.every(term => text.includes(term))) continue;
          let score = terms.every(term => name.includes(term)) ? 2 : 0;
          if (name.startsWith(terms[0])) score += 1;
          if (hasNutritionSource(item)) score += 1;
          results.push({ result: { restaurant, section: section.name, item }, score });
        }
      }
    }
    return results
      .sort((a, b) => b.score - a.score || a.result.item.name.localeCompare(b.result.item.name))
      .slice(0, limit)
      .map(r => r.result);
  }

  // ---- change notifications ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getRevision = (): number => this.revision;

  private apply(next: MenuState) {
    this.state = next;
    this.revision++;
    this.listeners.forEach(listener => listener());
  }

  // ---- startup: cache, then network ----

  start() {
    if (this.started) return;
    this.started = true;
    this.hydrateFromCache()
      .catch(error => logWarning('could not read cached menus', error))
      .finally(() => this.refresh());
    AppState.addEventListener('change', status => {
      if (status === 'active') this.refresh();
    });
  }

  private async hydrateFromCache() {
    const metaText = await AsyncStorage.getItem(CACHE_META_KEY);
    if (!metaText) return;
    const meta = JSON.parse(metaText) as { index: string };
    const index = parseIndex(meta.index);
    if (index.generated_at <= this.state.index.generated_at) return; // the app shipped newer data
    const versions = versionsOf(index);
    const needed = index.restaurants.filter(row => versions[row.id] !== this.bundledVersions[row.id]);
    const entries = await AsyncStorage.multiGet(needed.map(row => CACHE_RESTAURANT_PREFIX + row.id));
    const downloaded: MenuState['downloaded'] = new Map();
    for (const [key, value] of entries) {
      const id = key.slice(CACHE_RESTAURANT_PREFIX.length);
      if (!value) return; // incomplete cache: keep the bundled data
      const cached = JSON.parse(value) as CachedRestaurant;
      if (cached.version !== versions[id]) return;
      downloaded.set(id, { version: cached.version, menu: parseRestaurant(id, cached.data), icon: cached.icon });
    }
    this.apply({ index, versions, downloaded, source: 'cache' });
  }

  // Checks Firestore for newer menus. Safe to call often: throttled, and a
  // second call while one is running shares it. Resolves to whether data changed.
  refresh(options: { force?: boolean } = {}): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    if (!options.force && Date.now() - this.lastRefreshAttempt < REFRESH_INTERVAL_MS) return Promise.resolve(false);
    this.lastRefreshAttempt = Date.now();
    this.refreshing = this.refreshFromFirestore()
      .catch(async error => {
        // Most likely the publish landed between reading the index and a
        // restaurant; one retry reads a consistent set.
        if (error instanceof StaleDocumentError) return this.refreshFromFirestore();
        throw error;
      })
      .catch(error => {
        logWarning('could not refresh menus', error);
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async refreshFromFirestore(): Promise<boolean> {
    const db = getFirestore(getApps().length ? getApp() : initializeApp(firebaseConfig));
    const metaSnapshot = await withTimeout(getDoc(doc(db, 'menu_meta', 'current')), 'menu index');
    if (!metaSnapshot.exists()) return false;
    const meta = metaSnapshot.data() as RemoteMeta;
    if (meta.schema_version !== SUPPORTED_SCHEMA_VERSION) return false; // needs an app update
    if (meta.generated_at <= this.state.index.generated_at) return false;

    const index = parseIndex(meta.index);
    const versions = versionsOf(index);
    const current = this.state.downloaded;
    const toFetch = index.restaurants.filter(
      row => versions[row.id] !== this.bundledVersions[row.id] && current.get(row.id)?.version !== versions[row.id],
    );
    const fetched = await Promise.all(toFetch.map(async row => {
      const snapshot = await withTimeout(getDoc(doc(db, 'menu_restaurants', row.id)), row.id);
      const remote = snapshot.data() as RemoteRestaurant | undefined;
      if (!remote || remote.version !== versions[row.id]) throw new StaleDocumentError(row.id);
      return { id: row.id, remote, menu: parseRestaurant(row.id, remote.data) };
    }));

    const downloaded: MenuState['downloaded'] = new Map();
    for (const row of index.restaurants) {
      if (versions[row.id] === this.bundledVersions[row.id]) continue;
      const kept = current.get(row.id);
      if (kept?.version === versions[row.id]) downloaded.set(row.id, kept);
    }
    for (const { id, remote, menu } of fetched) {
      downloaded.set(id, { version: remote.version, menu, icon: remote.icon ?? null });
    }

    // Persist restaurants before the index that points at them.
    await AsyncStorage.multiSet(fetched.map(({ id, remote }) => [
      CACHE_RESTAURANT_PREFIX + id,
      JSON.stringify({ version: remote.version, data: remote.data, icon: remote.icon ?? null } satisfies CachedRestaurant),
    ]));
    await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify({ index: meta.index }));
    const keys = await AsyncStorage.getAllKeys();
    const obsolete = keys.filter(key => key.startsWith(CACHE_RESTAURANT_PREFIX) && !downloaded.has(key.slice(CACHE_RESTAURANT_PREFIX.length)));
    if (obsolete.length) await AsyncStorage.multiRemove(obsolete);

    this.apply({ index, versions, downloaded, source: 'remote' });
    return true;
  }
}

class StaleDocumentError extends Error {
  constructor(id: string) {
    super(`${id} changed while refreshing`);
  }
}

// Export singleton instance
export const menuDatabase = MenuDatabaseService.getInstance();

// Re-renders when newer menus arrive; returns a number that changes with them.
export function useMenuRevision(): number {
  return useSyncExternalStore(menuDatabase.subscribe, menuDatabase.getRevision);
}

// Re-render once a minute so open/closed badges stay current.
export function useClock(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

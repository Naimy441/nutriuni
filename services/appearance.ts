// The user's appearance choice: follow the phone, or always light or dark.
// Stored under `appearance`. Native controls (switches, keyboards, alerts)
// follow it too through Appearance.setColorScheme.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

export type AppearancePreference = 'system' | 'light' | 'dark';

const KEY = 'appearance';

class AppearanceStore {
  private value: AppearancePreference = 'system';
  private loading: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = () => this.value;

  private apply(value: AppearancePreference) {
    this.value = value;
    try {
      Appearance.setColorScheme?.(value === 'system' ? null : value);
    } catch {
      // Not supported on every platform; the app's own colors still follow.
    }
    this.listeners.forEach(listener => listener());
  }

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = AsyncStorage.getItem(KEY)
        .then(text => {
          if (text === 'light' || text === 'dark' || text === 'system') this.apply(text);
        })
        .catch(() => {});
    }
    return this.loading;
  }

  async set(value: AppearancePreference) {
    this.apply(value);
    await AsyncStorage.setItem(KEY, value);
  }
}

export const appearanceStore = new AppearanceStore();

export function useAppearance(): AppearancePreference {
  return useSyncExternalStore(appearanceStore.subscribe, appearanceStore.get);
}

// Design tokens for Nutriuni. Every screen reads colors from useTheme() so
// light and dark mode stay consistent; spacing/radius/type are shared scales.
import { Platform, TextStyle } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppearance } from '@/services/appearance';

const brand = {
  green: '#0E7C4A',
  greenDeep: '#006838', // logo green
  leaf: '#43B649',
};

export const nutrientColors = {
  calories: brand.green,
  protein: '#F0545A',
  carbs: '#3D8BF2',
  fat: '#F2A221',
  fiber: '#8B6CEF',
  sugar: '#E64C9A',
  sodium: '#14A8A0',
} as const;

export type NutrientColorKey = keyof typeof nutrientColors;

const light = {
  scheme: 'light' as 'light' | 'dark',
  background: '#F3F5F4',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#ECEFED',
  fill: 'rgba(120, 130, 125, 0.12)',
  fillStrong: 'rgba(120, 130, 125, 0.2)',
  separator: 'rgba(60, 70, 65, 0.12)',
  text: '#0F1A14',
  textSecondary: '#5B6961',
  textTertiary: '#8D9892',
  brand: brand.green,
  brandStrong: brand.greenDeep,
  brandSoft: 'rgba(14, 124, 74, 0.10)',
  brandText: '#0B6B3F',
  onBrand: '#FFFFFF',
  leaf: brand.leaf,
  warning: '#B7791F',
  warningSoft: 'rgba(214, 140, 30, 0.12)',
  danger: '#D93636',
  dangerSoft: 'rgba(217, 54, 54, 0.10)',
  success: '#2F9E44',
  shadow: '#0B1F14',
  hero: brand.green, // the Profile plan card
  onHero: '#FFFFFF',
  tabBar: 'rgba(255, 255, 255, 0.86)',
  overlay: 'rgba(8, 18, 12, 0.45)',
  ...nutrientColors,
};

const dark: typeof light = {
  scheme: 'dark',
  background: '#0A0E0C',
  surface: '#141A17',
  surfaceRaised: '#1A221E',
  surfaceMuted: '#1F2824',
  fill: 'rgba(200, 215, 205, 0.10)',
  fillStrong: 'rgba(200, 215, 205, 0.18)',
  separator: 'rgba(220, 235, 225, 0.10)',
  text: '#EEF3F0',
  textSecondary: '#A1AEA7',
  textTertiary: '#6E7B74',
  brand: '#2FBF71',
  brandStrong: '#1FA35C',
  brandSoft: 'rgba(47, 191, 113, 0.14)',
  brandText: '#5ED596',
  onBrand: '#04140B',
  leaf: brand.leaf,
  warning: '#F0B248',
  warningSoft: 'rgba(240, 178, 72, 0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.14)',
  success: '#4ADE80',
  shadow: '#000000',
  hero: '#104A2F',
  onHero: '#EEF3F0',
  tabBar: 'rgba(16, 22, 19, 0.86)',
  overlay: 'rgba(0, 0, 0, 0.55)',
  ...nutrientColors,
  calories: '#2FBF71',
};

export type Theme = typeof light;
export const themes = { light, dark };

export function useTheme(): Theme {
  const preference = useAppearance();
  const system = useColorScheme();
  const scheme = preference === 'system' ? system : preference;
  return scheme === 'dark' ? dark : light;
}

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

// iOS-style type scale; numbers use tabular figures so totals don't jitter.
export const type = {
  display: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1 },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.6 },
  title1: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  title2: { fontSize: 21, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  title3: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.2 },
  headline: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 17, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 15, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 13, fontWeight: '600', letterSpacing: 0.3 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export function shadow(theme: Theme, level: 1 | 2 | 3 = 1) {
  if (theme.scheme === 'dark') return {};
  const presets = {
    1: { shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    2: { shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    3: { shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  } as const;
  return { shadowColor: theme.shadow, ...presets[level] };
}

export const tabularNums: TextStyle = Platform.select({ default: { fontVariant: ['tabular-nums'] } });

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { Theme, useTheme } from '@/constants/theme';
import { appearanceStore } from '@/services/appearance';
import { goalsStore, useGoals } from '@/services/goals';
import { menuDatabase } from '@/services/MenuDatabase';
import { preferencesStore } from '@/services/preferences';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Keep the splash up until we know whether to show onboarding, so the first
// frame is the right screen instead of a flash of the wrong one.
SplashScreen.preventAutoHideAsync().catch(() => {});

// A screen opened from a link still has the tabs beneath it to go back to.
export const unstable_settings = { initialRouteName: '(tabs)' };

function navigationTheme(theme: Theme) {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.brand,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.separator,
      notification: theme.danger,
    },
  };
}

export default function RootLayout() {
  const theme = useTheme();
  const { onboarded } = useGoals();
  const [loaded, setLoaded] = useState(false);
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  // Load cached menus and check Firestore for newer ones in the background;
  // wait for settings so the first frame has the right screen and colors.
  useEffect(() => {
    menuDatabase.start();
    Promise.all([goalsStore.load(), appearanceStore.load(), preferencesStore.load()]).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // The window behind screens shows during modal and keyboard transitions.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  if (!loaded) return null;

  const headerOptions = {
    headerShown: true,
    headerBackTitle: 'Back',
    headerShadowVisible: false,
    headerTintColor: theme.brandText,
    headerStyle: { backgroundColor: theme.background },
    headerTitleStyle: { color: theme.text, fontWeight: '700' as const },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider value={navTheme}>
        <BottomSheetModalProvider>
          <ToastProvider>
            {onboarded ? (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="restaurant/[name]" />
                <Stack.Screen name="day/[date]" options={{ ...headerOptions, title: '' }} />
                <Stack.Screen name="log" options={{ presentation: 'modal' }} />
                <Stack.Screen name="goals" options={{ ...headerOptions, title: 'Daily targets' }} />
                <Stack.Screen name="plan" options={{ ...headerOptions, title: 'Meal plan' }} />
                <Stack.Screen name="profile-edit" options={{ ...headerOptions, title: 'Your details' }} />
                <Stack.Screen name="preferences" options={{ ...headerOptions, title: 'Food preferences' }} />
                <Stack.Screen name="sources" options={{ ...headerOptions, title: 'Sources & methods' }} />
                <Stack.Screen name="+not-found" options={{ ...headerOptions, title: 'Not found' }} />
              </Stack>
            ) : (
              <OnboardingScreen />
            )}
          </ToastProvider>
        </BottomSheetModalProvider>
      </ThemeProvider>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}

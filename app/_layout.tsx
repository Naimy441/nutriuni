import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { useColorScheme } from '@/hooks/useColorScheme';

// Debug flag - set to false for production
const DEBUG_MODE = true;

// Debug function to clear all storage on app load
const clearAllStorageForDebug = async () => {
  if (!DEBUG_MODE) {
    return;
  }
  
  try {
    console.log('🧹 Debug: Clearing all storage...');
    
    // Get all keys to see what we're clearing
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('📋 Keys found:', allKeys);
    
    // Clear all keys
    await AsyncStorage.clear();
    
    console.log('✅ Debug: All storage cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
  }
};

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (loaded) {
      // Clear storage for debugging purposes
      clearAllStorageForDebug().then(() => {
        checkOnboardingStatus();
      });
    }
  }, [loaded]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingComplete = await AsyncStorage.getItem('onboarding_complete');
      setShowOnboarding(onboardingComplete !== 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = (goals: NutritionGoals) => {
    setShowOnboarding(false);
  };

  if (!loaded || showOnboarding === null) {
    return null;
  }

  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="restaurant/[name]" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

// Development only: loads the store-screenshot demo data, then opens Today.
// Production builds go straight to Today without touching anything.
import { AppText } from '@/components/ui/AppText';
import { space, useTheme } from '@/constants/theme';
import { seedScreenshotData } from '@/screenshots/seed';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function ScreenshotSeed() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    seedScreenshotData()
      .then(() => router.replace('/'))
      .catch(e => setError(String(e)));
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error ? <AppText tone="danger">{error}</AppText> : <ActivityIndicator color={theme.brand} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
});

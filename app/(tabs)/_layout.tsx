import { TabBar } from '@/components/ui/TabBar';
import { useTheme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="menus" options={{ title: 'Dining' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

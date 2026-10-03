// Bottom tab bar: four tabs around a raised "+" that opens the Log sheet from
// anywhere, the pattern most food trackers use to keep logging one tap away.
import { radius, shadow, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { PressableScale, triggerHaptic } from './PressableScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Today', icon: 'today-outline', activeIcon: 'today' },
  menus: { label: 'Dining', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  progress: { label: 'Progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  profile: { label: 'Profile', icon: 'person-circle-outline', activeIcon: 'person-circle' },
};

export const TAB_BAR_HEIGHT = 58;

// Bottom padding for scroll content so the last row clears the tab bar.
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.sm) + space.xxl;
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routes = state.routes.filter(route => TABS[route.name]);
  const middle = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.indexOf(route);
    const focused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        triggerHaptic('selection');
        navigation.navigate(route.name, route.params);
      }
    };
    return <TabButton key={route.key} name={route.name} focused={focused} onPress={onPress} />;
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {Platform.OS === 'ios' ? (
        <BlurView tint={theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={90} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />
      )}
      <View style={[styles.topBorder, { backgroundColor: theme.separator }]} />
      <View style={styles.row}>
        {routes.slice(0, middle).map(renderTab)}
        <View style={styles.centerSlot}>
          <PressableScale
            onPress={() => router.push('/log')}
            haptic="medium"
            scaleTo={0.9}
            accessibilityLabel="Log food"
            accessibilityHint="Search dining menus, recent foods, or add calories"
            style={[styles.logButton, { backgroundColor: theme.brand }, shadow(theme, 2)]}
          >
            <Ionicons name="add" size={30} color={theme.onBrand} />
          </PressableScale>
        </View>
        {routes.slice(middle).map(renderTab)}
      </View>
    </View>
  );
}

function TabButton({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const theme = useTheme();
  const tab = TABS[name];
  const scale = useSharedValue(focused ? 1 : 0.92);
  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.92, { damping: 14, stiffness: 240 });
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? theme.brandText : theme.textTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? tab.activeIcon : tab.icon} size={24} color={color} />
      </Animated.View>
      <AppText variant="micro" color={color} weight={focused ? '700' : '600'} style={styles.label}>
        {tab.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: TAB_BAR_HEIGHT,
  },
  label: {
    letterSpacing: 0.1,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
});

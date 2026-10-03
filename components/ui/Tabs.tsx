// Text tabs with a sliding underline: switches what a screen shows, as
// opposed to Segmented, which picks a value.
import { space, useTheme } from '@/constants/theme';
import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { AppText } from './AppText';
import { triggerHaptic } from './PressableScale';

const INSET = 12;

interface TabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function Tabs<T extends string>({ options, value, onChange, style }: TabsProps<T>) {
  const theme = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const current = layouts[value];
  const indicator = useAnimatedStyle(() => ({
    opacity: current ? 1 : 0,
    width: withSpring(Math.max(0, (current?.width ?? 0) - INSET * 2), { damping: 20, stiffness: 220 }),
    transform: [{ translateX: withSpring((current?.x ?? 0) + INSET, { damping: 20, stiffness: 220 }) }],
  }));
  return (
    <View style={[styles.row, { borderBottomColor: theme.separator }, style]} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={(event: LayoutChangeEvent) => {
              const { x, width } = event.nativeEvent.layout;
              setLayouts(prev => ({ ...prev, [option.value]: { x, width } }));
            }}
            onPress={() => {
              if (!selected) {
                triggerHaptic('selection');
                onChange(option.value);
              }
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <AppText variant="subhead" weight={selected ? '700' : '500'} tone={selected ? 'primary' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.indicator, { backgroundColor: theme.brand }, indicator]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: -StyleSheet.hairlineWidth,
    height: 2.5,
    borderRadius: 2,
  },
});

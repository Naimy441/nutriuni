import { radius, shadow, space, useTheme } from '@/constants/theme';
import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { AppText } from './AppText';
import { triggerHaptic } from './PressableScale';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

// iOS-style segmented control with a sliding thumb.
export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const segment = width ? (width - 4) / options.length : 0;
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * segment, { damping: 20, stiffness: 220 }) }],
  }));
  return (
    <View
      style={[styles.track, { backgroundColor: theme.fill }, style]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: segment, backgroundColor: theme.scheme === 'dark' ? theme.surfaceMuted : theme.surface },
            shadow(theme, 1),
            thumbStyle,
          ]}
        />
      )}
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => {
              if (!selected) {
                triggerHaptic('selection');
                onChange(option.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <AppText variant="subhead" weight={selected ? '700' : '500'} tone={selected ? 'primary' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 2,
    height: 36,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: radius.md - 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});

import { radius, useTheme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  progress: number; // 0..1
  color: string;
  height?: number;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ progress, color, height = 8, trackColor, style }: ProgressBarProps) {
  const theme = useTheme();
  const width = useSharedValue(0);
  const value = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  useEffect(() => {
    value.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, value]);
  const fillStyle = useAnimatedStyle(() => ({ width: Math.max(value.value > 0 ? height : 0, width.value * value.value) }));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => {
        width.value = e.nativeEvent.layout.width;
      }}
      style={[{ height, borderRadius: radius.pill, backgroundColor: trackColor ?? theme.fill, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

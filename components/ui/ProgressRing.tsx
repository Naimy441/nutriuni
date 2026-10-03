import { useTheme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  size: number;
  stroke: number;
  progress: number; // 0..1, values above 1 show as full with an overflow color
  color: string;
  overColor?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

// Animated circular progress; sweeps to its value on mount and on change.
export function ProgressRing({ size, stroke, progress, color, overColor, trackColor, children }: ProgressRingProps) {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  useEffect(() => {
    value.value = withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [clamped, value]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));
  const over = progress > 1;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? theme.fill} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over && overColor ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}

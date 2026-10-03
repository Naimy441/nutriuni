import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'light' | 'medium' | 'selection' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: HapticKind;
}

export function triggerHaptic(kind: HapticKind) {
  if (kind === 'none') return;
  if (kind === 'selection') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Pressable that shrinks slightly while held, the standard iOS "touchable" feel.
export function PressableScale({ style, scaleTo = 0.97, haptic = 'none', onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={event => {
        scale.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        onPressOut?.(event);
      }}
      onPress={event => {
        triggerHaptic(haptic);
        onPress?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
      {...rest}
    />
  );
}

import { useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { HapticKind, PressableScale } from './PressableScale';

interface IconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  variant?: 'filled' | 'plain' | 'brand';
  color?: string;
  haptic?: HapticKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon, onPress, accessibilityLabel, size = 36, variant = 'filled', color, haptic = 'selection', disabled, style,
}: IconButtonProps) {
  const theme = useTheme();
  const bg = variant === 'filled' ? theme.fill : variant === 'brand' ? theme.brand : 'transparent';
  const fg = color ?? (variant === 'brand' ? theme.onBrand : variant === 'plain' ? theme.brandText : theme.text);
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </PressableScale>
  );
}

import { radius, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { HapticKind, PressableScale } from './PressableScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'tinted' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  title, onPress, variant = 'primary', size = 'lg', icon, trailingIcon, loading, disabled,
  fullWidth, haptic = 'light', style, accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.brand, fg: theme.onBrand, border: 'transparent' },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.separator },
    tinted: { bg: theme.brandSoft, fg: theme.brandText, border: 'transparent' },
    ghost: { bg: 'transparent', fg: theme.brandText, border: 'transparent' },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: 'transparent' },
  }[variant];
  const metrics = {
    lg: { height: 54, px: space.xl, text: 'headline' as const, icon: 20 },
    md: { height: 44, px: space.lg, text: 'headline' as const, icon: 18 },
    sm: { height: 34, px: space.md, text: 'subhead' as const, icon: 16 },
  }[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        {
          height: metrics.height,
          paddingHorizontal: metrics.px,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderRadius: size === 'sm' ? radius.pill : radius.lg,
        },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={metrics.icon} color={palette.fg} />}
          <AppText variant={metrics.text} color={palette.fg} weight="600" numberOfLines={1}>
            {title}
          </AppText>
          {trailingIcon && <Ionicons name={trailingIcon} size={metrics.icon} color={palette.fg} />}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});

import { tabularNums, type as typeScale, TypeVariant, useTheme } from '@/constants/theme';
import React from 'react';
import { Text, TextProps } from 'react-native';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'onBrand' | 'danger' | 'warning';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'left' | 'center' | 'right';
  numeric?: boolean; // tabular figures, for numbers that change
}

export function AppText({ variant = 'body', tone = 'primary', color, weight, align, numeric, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const toneColor = {
    primary: theme.text,
    secondary: theme.textSecondary,
    tertiary: theme.textTertiary,
    brand: theme.brandText,
    onBrand: theme.onBrand,
    danger: theme.danger,
    warning: theme.warning,
  }[tone];
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      style={[
        typeScale[variant],
        { color: color ?? toneColor },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        numeric && tabularNums,
        style,
      ]}
      {...rest}
    />
  );
}

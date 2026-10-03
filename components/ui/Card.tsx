import { radius, shadow, space, useTheme } from '@/constants/theme';
import React from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';

interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ padded = true, elevated = true, onPress, style, children, accessibilityLabel, ...rest }: CardProps) {
  const theme = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: padded ? space.lg : 0,
      borderWidth: theme.scheme === 'dark' ? 1 : 0,
      borderColor: theme.separator,
    },
    elevated && shadow(theme, 1),
    style,
  ];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.98} style={cardStyle} accessibilityLabel={accessibilityLabel}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

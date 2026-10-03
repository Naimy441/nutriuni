import { radius, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, icon, style }: ChipProps) {
  const theme = useTheme();
  const fg = selected ? theme.onBrand : theme.text;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.md + 2,
          height: 34,
          borderRadius: radius.pill,
          backgroundColor: selected ? theme.brand : theme.surface,
          borderWidth: selected ? 0 : 1,
          borderColor: theme.separator,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={15} color={selected ? fg : theme.brandText} />}
      <AppText variant="subhead" weight="600" color={fg}>{label}</AppText>
    </PressableScale>
  );
}

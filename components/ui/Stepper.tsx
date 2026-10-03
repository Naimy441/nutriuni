import { radius, space, useTheme } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  label: string; // for accessibility
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format = String, label }: StepperProps) {
  const theme = useTheme();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next * 100) / 100)));
  return (
    <View
      style={[styles.container, { backgroundColor: theme.fill }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => set(value + (event.nativeEvent.actionName === 'increment' ? step : -step))}
    >
      <IconButton icon="remove" size={32} variant="plain" accessibilityLabel={`Less ${label}`} disabled={value <= min} onPress={() => set(value - step)} />
      <AppText variant="headline" numeric style={styles.value}>{format(value)}</AppText>
      <IconButton icon="add" size={32} variant="plain" accessibilityLabel={`More ${label}`} disabled={value >= max} onPress={() => set(value + step)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    height: 40,
  },
  value: {
    minWidth: 36,
    textAlign: 'center',
  },
});

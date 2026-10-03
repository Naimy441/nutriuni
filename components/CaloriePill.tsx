import { radius, useTheme } from '@/constants/theme';
import type { PreviewKind } from '@/services/menuNutrition';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './ui/AppText';

interface CaloriePillProps {
  kind: PreviewKind;
  calories?: number;
}

// Calories for a dish's default order in menu lists. "~" marks estimates
// built from components; "No info" means Duke hasn't published a label.
export function CaloriePill({ kind, calories }: CaloriePillProps) {
  const theme = useTheme();
  if (kind === 'none') {
    return (
      <View style={[styles.pill, { backgroundColor: theme.fill }]}>
        <AppText variant="caption" weight="600" tone="tertiary">No info</AppText>
      </View>
    );
  }
  if (kind === 'choose' || calories === undefined) {
    return (
      <View style={[styles.pill, { borderWidth: 1, borderColor: theme.fillStrong }]}>
        <AppText variant="caption" weight="600" tone="brand">Pick options</AppText>
      </View>
    );
  }
  const prefix = kind === 'estimated' || kind === 'partial' ? '~' : '';
  return (
    <View style={[styles.pill, { backgroundColor: theme.brandSoft }]}>
      <AppText variant="caption" weight="700" tone="brand" numeric>
        {prefix}{calories.toLocaleString()} cal
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});

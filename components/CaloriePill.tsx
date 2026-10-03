import { Colors } from '@/constants/Colors';
import type { PreviewKind } from '@/services/menuNutrition';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';

interface CaloriePillProps {
  kind: PreviewKind;
  calories?: number;
}

// Calories for a dish's default order in menu lists. "~" marks estimates
// built from components; "No info" means Duke hasn't published a label.
export function CaloriePill({ kind, calories }: CaloriePillProps) {
  if (kind === 'none') {
    return (
      <View style={[styles.pill, styles.muted]}>
        <ThemedText style={[styles.text, styles.mutedText]}>No info</ThemedText>
      </View>
    );
  }
  if (kind === 'choose' || calories === undefined) {
    return (
      <View style={[styles.pill, styles.outline]}>
        <ThemedText style={[styles.text, styles.outlineText]}>Pick options</ThemedText>
      </View>
    );
  }
  const prefix = kind === 'estimated' || kind === 'partial' ? '~' : '';
  return (
    <View style={[styles.pill, styles.filled]}>
      <ThemedText style={[styles.text, styles.filledText]}>
        {prefix}{calories.toLocaleString()} cal
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  filled: {
    backgroundColor: 'rgba(0, 104, 56, 0.14)',
  },
  filledText: {
    color: Colors.primary,
  },
  outline: {
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.45)',
  },
  outlineText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  muted: {
    backgroundColor: 'rgba(128, 128, 128, 0.14)',
  },
  mutedText: {
    opacity: 0.65,
    fontWeight: '600',
  },
});

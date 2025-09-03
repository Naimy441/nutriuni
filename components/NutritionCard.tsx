import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { CircularProgress } from './CircularProgress';

interface NutritionCardProps {
  title: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  size?: number;
}

export function NutritionCard({
  title,
  current,
  target,
  unit,
  color,
  size = 100,
}: NutritionCardProps) {
  const progress = Math.min(current / target, 1);
  const percentage = Math.round(progress * 100);

  return (
    <ThemedView style={styles.container}>
      <CircularProgress
        size={size}
        strokeWidth={8}
        progress={progress}
        color={color}
      >
        <ThemedText style={styles.percentage}>{percentage}%</ThemedText>
        <ThemedText style={styles.values}>
          {Math.round(current)}/{target}
        </ThemedText>
      </CircularProgress>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.unit}>{unit}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    minWidth: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  percentage: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  values: {
    fontSize: 12,
    opacity: 0.7,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  unit: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
});

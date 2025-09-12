import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { CircularProgress } from './CircularProgress';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface NutritionCardProps {
  title: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  size?: number;
  onPress?: () => void;
}

export function NutritionCard({
  title,
  current,
  target,
  unit,
  color,
  size = 100,
  onPress,
}: NutritionCardProps) {
  const progress = Math.min(current / target, 1); // Still cap visual progress at 100%
  const percentage = Math.round((current / target) * 100); // But show actual percentage

  const content = (
    <>
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
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.container}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {content}
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

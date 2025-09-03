import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { NutritionCard } from '@/components/NutritionCard';

// Mock nutrition data - you'll replace this with real data later
interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
  fiber: { current: number; target: number };
  sugar: { current: number; target: number };
}

export default function HomeScreen() {
  const [nutritionData, setNutritionData] = useState<NutritionData>({
    calories: { current: 1450, target: 2000 },
    protein: { current: 85, target: 120 },
    carbs: { current: 180, target: 250 },
    fat: { current: 45, target: 65 },
    fiber: { current: 18, target: 25 },
    sugar: { current: 35, target: 50 },
  });

  // Get current date string
  const getCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            NutriUni
          </ThemedText>
          <ThemedText style={styles.date}>{getCurrentDate()}</ThemedText>
        </ThemedView>

        {/* Daily Summary */}
        <ThemedView style={styles.summaryContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Daily Progress
          </ThemedText>
          
          {/* Main Calories Card */}
          <View style={styles.caloriesContainer}>
            <NutritionCard
              title="Calories"
              current={nutritionData.calories.current}
              target={nutritionData.calories.target}
              unit="kcal"
              color="#FF6B6B"
              size={140}
            />
          </View>

          {/* Macros Grid */}
          <ThemedText type="defaultSemiBold" style={styles.macrosTitle}>
            Macronutrients
          </ThemedText>
          <View style={styles.macrosGrid}>
            <NutritionCard
              title="Protein"
              current={nutritionData.protein.current}
              target={nutritionData.protein.target}
              unit="g"
              color="#4ECDC4"
              size={100}
            />
            <NutritionCard
              title="Carbs"
              current={nutritionData.carbs.current}
              target={nutritionData.carbs.target}
              unit="g"
              color="#45B7D1"
              size={100}
            />
            <NutritionCard
              title="Fat"
              current={nutritionData.fat.current}
              target={nutritionData.fat.target}
              unit="g"
              color="#F7DC6F"
              size={100}
            />
          </View>

          {/* Additional Nutrients */}
          <ThemedText type="defaultSemiBold" style={styles.macrosTitle}>
            Other Nutrients
          </ThemedText>
          <View style={styles.macrosGrid}>
            <NutritionCard
              title="Fiber"
              current={nutritionData.fiber.current}
              target={nutritionData.fiber.target}
              unit="g"
              color="#A8E6CF"
              size={90}
            />
            <NutritionCard
              title="Sugar"
              current={nutritionData.sugar.current}
              target={nutritionData.sugar.target}
              unit="g"
              color="#FFB3BA"
              size={90}
            />
          </View>

          {/* Quick Stats */}
          <ThemedView style={styles.quickStats}>
            <ThemedText type="defaultSemiBold" style={styles.quickStatsTitle}>
              Quick Stats
            </ThemedText>
            <View style={styles.statsRow}>
              <ThemedText style={styles.statText}>
                Remaining: {nutritionData.calories.target - nutritionData.calories.current} kcal
              </ThemedText>
            </View>
            <View style={styles.statsRow}>
              <ThemedText style={styles.statText}>
                Protein: {Math.round((nutritionData.protein.current / nutritionData.protein.target) * 100)}% of goal
              </ThemedText>
            </View>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    color: '#FF6B6B',
  },
  date: {
    fontSize: 16,
    opacity: 0.7,
  },
  summaryContainer: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 20,
    textAlign: 'center',
  },
  caloriesContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  macrosTitle: {
    marginBottom: 16,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 18,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  quickStats: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickStatsTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  statsRow: {
    marginVertical: 4,
  },
  statText: {
    textAlign: 'center',
    opacity: 0.8,
  },
});

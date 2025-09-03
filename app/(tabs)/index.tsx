import { NutritionCard } from '@/components/NutritionCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

// Nutrition targets - you can make these configurable later
const NUTRITION_TARGETS = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  fiber: 25,
  sugar: 50,
};

export default function HomeScreen() {
  const { dailyNutrition, todaysItems, isLoading, removeItem, clearAll, refresh } = useNutritionTracker();
  const [showItemsList, setShowItemsList] = useState(false);

  // Refresh nutrition data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      Alert.alert('Error', 'Failed to remove item. Please try again.');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Items',
      'Are you sure you want to clear all items from today\'s log? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAll();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear items. Please try again.');
            }
          }
        },
      ]
    );
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
              current={dailyNutrition.calories}
              target={NUTRITION_TARGETS.calories}
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
              current={dailyNutrition.protein}
              target={NUTRITION_TARGETS.protein}
              unit="g"
              color="#4ECDC4"
              size={100}
            />
            <NutritionCard
              title="Carbs"
              current={dailyNutrition.carbs}
              target={NUTRITION_TARGETS.carbs}
              unit="g"
              color="#45B7D1"
              size={100}
            />
            <NutritionCard
              title="Fat"
              current={dailyNutrition.fat}
              target={NUTRITION_TARGETS.fat}
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
              current={dailyNutrition.fiber}
              target={NUTRITION_TARGETS.fiber}
              unit="g"
              color="#A8E6CF"
              size={90}
            />
            <NutritionCard
              title="Sugar"
              current={dailyNutrition.sugar}
              target={NUTRITION_TARGETS.sugar}
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
                Remaining: {NUTRITION_TARGETS.calories - dailyNutrition.calories} kcal
              </ThemedText>
            </View>
            <View style={styles.statsRow}>
              <ThemedText style={styles.statText}>
                Protein: {Math.round((dailyNutrition.protein / NUTRITION_TARGETS.protein) * 100)}% of goal
              </ThemedText>
            </View>
          </ThemedView>

          {/* Today's Items */}
          {todaysItems.length > 0 && (
            <ThemedView style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <ThemedText type="defaultSemiBold" style={styles.itemsTitle}>
                  Today's Items ({todaysItems.length})
                </ThemedText>
                <View style={styles.itemsActions}>
                  <TouchableOpacity 
                    onPress={() => setShowItemsList(!showItemsList)}
                    style={styles.toggleButton}
                  >
                    <Ionicons 
                      name={showItemsList ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#4ECDC4" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>

              {showItemsList && (
                <View style={styles.itemsList}>
                  {todaysItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                        <ThemedText style={styles.itemDetails}>
                          {item.restaurant} • {item.calories} cal • {item.serving_size}
                        </ThemedText>
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleRemoveItem(item.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close" size={16} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ThemedView>
          )}
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
  itemsSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 16,
  },
  itemsActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    padding: 4,
  },
  clearButton: {
    padding: 4,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

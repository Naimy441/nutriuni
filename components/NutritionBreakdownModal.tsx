import { Colors } from '@/constants/Colors';
import { TrackedItem } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface NutritionBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  nutritionType: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar';
  todaysItems: TrackedItem[];
  total: number;
  unit: string;
}

export function NutritionBreakdownModal({
  visible,
  onClose,
  nutritionType,
  todaysItems,
  total,
  unit,
}: NutritionBreakdownModalProps) {
  
  // Get the value for the specific nutrition type from an item
  const getNutritionValue = (item: TrackedItem): number => {
    switch (nutritionType) {
      case 'calories': return item.calories;
      case 'protein': return item.protein;
      case 'carbs': return item.carbs;
      case 'fat': return item.fat;
      case 'fiber': return item.fiber;
      case 'sugar': return item.sugar;
      default: return 0;
    }
  };

  // Calculate breakdown data
  const breakdownData = todaysItems
    .map(item => ({
      item,
      value: getNutritionValue(item),
      percentage: total > 0 ? (getNutritionValue(item) / total) * 100 : 0,
    }))
    .filter(data => data.value > 0) // Only show items that contribute to this nutrition
    .sort((a, b) => b.value - a.value); // Sort by highest contribution first

  const getNutritionTypeLabel = () => {
    switch (nutritionType) {
      case 'calories': return 'Calories';
      case 'protein': return 'Protein';
      case 'carbs': return 'Carbohydrates';
      case 'fat': return 'Fat';
      case 'fiber': return 'Fiber';
      case 'sugar': return 'Sugar';
      default: return 'Nutrition';
    }
  };

  const getColor = () => {
    switch (nutritionType) {
      case 'calories': return Colors.primary;
      case 'protein': return '#E74C3C';
      case 'carbs': return '#3498DB';
      case 'fat': return '#F39C12';
      case 'fiber': return '#9B59B6';
      case 'sugar': return '#E91E63';
      default: return Colors.primary;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <ThemedText type="title" style={styles.title}>
              {getNutritionTypeLabel()} Breakdown
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Total: {Math.round(total)} {unit}
            </ThemedText>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {breakdownData.length > 0 ? (
            <View style={styles.breakdownContainer}>
              {breakdownData.map((data, index) => (
                <View key={data.item.id} style={styles.breakdownItem}>
                  <View style={styles.itemInfo}>
                    <ThemedText style={styles.itemName}>{data.item.name}</ThemedText>
                    <ThemedText style={styles.itemRestaurant}>{data.item.restaurant}</ThemedText>
                  </View>
                  
                  <View style={styles.itemStats}>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBackground}>
                        <View 
                          style={[
                            styles.progressBarFill, 
                            { 
                              width: `${data.percentage}%`,
                              backgroundColor: getColor(),
                            }
                          ]} 
                        />
                      </View>
                      <ThemedText style={styles.percentageText}>
                        {data.percentage.toFixed(1)}%
                      </ThemedText>
                    </View>
                    
                    <ThemedText style={styles.valueText}>
                      {Math.round(data.value)} {unit}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="analytics-outline" size={48} color="rgba(128, 128, 128, 0.5)" />
              <ThemedText style={styles.emptyText}>
                No {getNutritionTypeLabel().toLowerCase()} data available
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Add some food items to see the breakdown
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  breakdownContainer: {
    padding: 20,
  },
  breakdownItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemInfo: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemRestaurant: {
    fontSize: 14,
    opacity: 0.7,
  },
  itemStats: {
    gap: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'right',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 20,
  },
});

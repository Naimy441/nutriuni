import { Colors } from '@/constants/Colors';
import { HistoryDay, useFoodHistory } from '@/services/FoodHistoryService';
import { TrackedItem } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { TrackedItemModal } from './TrackedItemModal';

interface FoodHistorySectionProps {
  onViewAllHistory: () => void;
}

export function FoodHistorySection({ onViewAllHistory }: FoodHistorySectionProps) {
  const { pastThreeDays, isLoading, error, toggleDayExpansion } = useFoodHistory();
  const [selectedItem, setSelectedItem] = useState<TrackedItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  const handleItemPress = (item: TrackedItem) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleDayToggle = (dateString: string) => {
    toggleDayExpansion(dateString);
  };

  const renderNutritionSummary = (day: HistoryDay) => {
    const { totals } = day.log;
    return (
      <View style={styles.nutritionSummary}>
        <View style={styles.nutritionItem}>
          <ThemedText style={styles.nutritionValue}>{Math.round(totals.calories)}</ThemedText>
          <ThemedText style={styles.nutritionLabel}>cal</ThemedText>
        </View>
        <View style={styles.nutritionItem}>
          <ThemedText style={styles.nutritionValue}>{Math.round(totals.protein)}</ThemedText>
          <ThemedText style={styles.nutritionLabel}>protein</ThemedText>
        </View>
        <View style={styles.nutritionItem}>
          <ThemedText style={styles.nutritionValue}>{Math.round(totals.carbs)}</ThemedText>
          <ThemedText style={styles.nutritionLabel}>carbs</ThemedText>
        </View>
        <View style={styles.nutritionItem}>
          <ThemedText style={styles.nutritionValue}>{Math.round(totals.fat)}</ThemedText>
          <ThemedText style={styles.nutritionLabel}>fat</ThemedText>
        </View>
      </View>
    );
  };

  const renderFoodItem = (item: TrackedItem) => {
    // Format timestamp to show time
    const time = new Date(item.timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.foodItem}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.foodItemInfo}>
          <ThemedText style={styles.foodItemName}>{item.name}</ThemedText>
          <ThemedText style={styles.foodItemDetails}>
            {item.restaurant} • {item.calories} cal • {time}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </TouchableOpacity>
    );
  };

  const renderHistoryDay = (day: HistoryDay) => {
    const hasItems = day.log.items.length > 0;
    
    return (
      <ThemedView key={day.date} style={styles.dayContainer}>
        <TouchableOpacity 
          style={styles.dayHeader}
          onPress={() => handleDayToggle(day.date)}
          disabled={!hasItems}
        >
          <View style={styles.dayHeaderLeft}>
            <ThemedText style={styles.dayTitle}>{day.displayDate}</ThemedText>
            <ThemedText style={styles.dayItemCount}>
              {hasItems ? `${day.log.items.length} items` : 'No items logged'}
            </ThemedText>
          </View>
          <View style={styles.dayHeaderRight}>
            {hasItems && renderNutritionSummary(day)}
            {hasItems && (
              <Ionicons 
                name={day.isExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={Colors.primary} 
                style={styles.expandIcon}
              />
            )}
          </View>
        </TouchableOpacity>

        {day.isExpanded && hasItems && (
          <View style={styles.dayContent}>
            {day.log.items.map(renderFoodItem)}
          </View>
        )}
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Food History</ThemedText>
        </View>
        <ThemedText style={styles.loadingText}>Loading history...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Food History</ThemedText>
        </View>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  // Don't show the section if there's no history
  if (pastThreeDays.length === 0) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Food History</ThemedText>
        <TouchableOpacity 
          onPress={onViewAllHistory}
          style={styles.viewAllButton}
        >
          <ThemedText style={styles.viewAllText}>View All</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.historyList}>
        {pastThreeDays.map(renderHistoryDay)}
      </View>

      <TrackedItemModal
        visible={showItemModal}
        trackedItem={selectedItem}
        onClose={() => {
          setShowItemModal(false);
          setSelectedItem(null);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  historyList: {
    gap: 12,
  },
  dayContainer: {
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayItemCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  nutritionSummary: {
    flexDirection: 'row',
    gap: 8,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  nutritionLabel: {
    fontSize: 10,
    opacity: 0.7,
    lineHeight: 12,
  },
  expandIcon: {
    marginLeft: 8,
  },
  dayContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  foodItemInfo: {
    flex: 1,
  },
  foodItemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  foodItemDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  loadingText: {
    textAlign: 'center',
    opacity: 0.7,
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#E74C3C',
    padding: 20,
  },
});

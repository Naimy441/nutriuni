import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HistoryDay, useAllFoodHistory } from '@/services/FoodHistoryService';
import { TrackedItem } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { TrackedItemModal } from './TrackedItemModal';

interface AllFoodHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AllFoodHistoryModal({ visible, onClose }: AllFoodHistoryModalProps) {
  const colorScheme = useColorScheme();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { allHistory, isLoading, error, toggleDayExpansion, loadAllHistory } = useAllFoodHistory();
  const [selectedItem, setSelectedItem] = useState<TrackedItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  // Fixed snap points
  const snapPoints = useMemo(() => ['50%', '80%', '100%'], []);

  // Handle sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Control sheet visibility
  useEffect(() => {
    if (visible) {
      loadAllHistory();
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, loadAllHistory]);

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

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ThemedText style={styles.loadingText}>Loading all history...</ThemedText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity 
            onPress={loadAllHistory}
            style={styles.retryButton}
          >
            <ThemedText style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (allHistory.length === 0) {
      return (
        <View style={styles.centerContent}>
          <ThemedText style={styles.emptyText}>No food history available</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Start logging your meals to see them here!
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.historyList}>
        {allHistory.map(renderHistoryDay)}
      </View>
    );
  };

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backgroundStyle={{
          backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
        }}
        handleIndicatorStyle={{
          backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
          opacity: 0.3,
        }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>All Food History</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <TrackedItemModal
        visible={showItemModal}
        trackedItem={selectedItem}
        onClose={() => {
          setShowItemModal(false);
          setSelectedItem(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    opacity: 0.7,
    fontSize: 16,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  historyList: {
    gap: 16,
  },
  dayContainer: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayItemCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  nutritionSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  nutritionLabel: {
    fontSize: 11,
    opacity: 0.7,
    lineHeight: 13,
  },
  expandIcon: {
    marginLeft: 8,
  },
  dayContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  foodItemInfo: {
    flex: 1,
  },
  foodItemName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
  },
  foodItemDetails: {
    fontSize: 13,
    opacity: 0.7,
  },
});

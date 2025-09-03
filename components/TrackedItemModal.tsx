import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TrackedItem } from '@/services/NutritionTracker';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface TrackedItemModalProps {
  visible: boolean;
  trackedItem: TrackedItem | null;
  onClose: () => void;
}

export function TrackedItemModal({ visible, trackedItem, onClose }: TrackedItemModalProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme();

  // Fixed snap points with scrollable content
  const snapPoints = useMemo(() => ['30%', '60%', '100%'], []);

  // Handle sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Control sheet visibility
  useEffect(() => {
    if (visible && trackedItem) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, trackedItem]);

  if (!trackedItem) return null;

  const renderNutrientRow = (label: string, value: number, unit: string) => (
    <View key={label} style={styles.nutritionRow}>
      <ThemedText style={styles.nutritionLabel}>{label}</ThemedText>
      <ThemedText style={styles.nutritionAmount}>
        {value}{unit}
      </ThemedText>
    </View>
  );

  // Format the timestamp to a readable time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={1}
      onChange={handleSheetChanges}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={true}
      enableOverDrag={false}
      topInset={60}
      backgroundStyle={[
        styles.bottomSheetBackground,
        { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' }
      ]}
      handleIndicatorStyle={[
        styles.handleIndicator,
        { backgroundColor: colorScheme === 'dark' ? '#666' : '#ccc' }
      ]}
      android_keyboardInputMode="adjustResize"
      keyboardBehavior="extend"
    >
      {/* Header - Fixed outside scroll */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText type="title" style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {trackedItem.name}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {trackedItem.restaurant} • Added at {formatTime(trackedItem.timestamp)}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <ThemedText style={styles.closeText}>×</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <BottomSheetScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Calories - First Priority */}
        <ThemedView style={styles.caloriesContainer}>
          <View style={styles.caloriesRow}>
            <ThemedText type="title" style={styles.caloriesLabel}>
              Calories
            </ThemedText>
            <ThemedText type="title" style={styles.caloriesValue}>
              {trackedItem.calories}
            </ThemedText>
          </View>
        </ThemedView>

        {/* Serving Info */}
        <View style={styles.servingContainer}>
          <ThemedText style={styles.servingText}>
            Serving Size: {trackedItem.serving_size}
          </ThemedText>
        </View>

        {/* Macronutrients */}
        <ThemedView style={styles.nutrientsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Macronutrients
          </ThemedText>
          <View style={styles.nutritionFacts}>
            {renderNutrientRow('Protein', trackedItem.protein, 'g')}
            {renderNutrientRow('Carbohydrates', trackedItem.carbs, 'g')}
            {renderNutrientRow('Fat', trackedItem.fat, 'g')}
          </View>
        </ThemedView>

        {/* Other Nutrients */}
        <ThemedView style={styles.nutrientsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Other Nutrients
          </ThemedText>
          <View style={styles.nutritionFacts}>
            {renderNutrientRow('Fiber', trackedItem.fiber, 'g')}
            {renderNutrientRow('Sugar', trackedItem.sugar, 'g')}
            {renderNutrientRow('Sodium', trackedItem.sodium, 'mg')}
          </View>
        </ThemedView>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  bottomSheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  handleIndicator: {
    width: 40,
    height: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: Colors.primary,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '300',
    opacity: 0.8,
  },
  servingContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
  },
  servingText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
  },
  caloriesContainer: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 104, 56, 0.1)',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caloriesLabel: {
    color: Colors.primary,
  },
  caloriesValue: {
    color: Colors.primary,
    fontSize: 32,
  },
  nutrientsContainer: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  sectionTitle: {
    marginBottom: 10,
    color: Colors.primary,
    fontSize: 16,
  },
  nutritionFacts: {
    gap: 8,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  nutritionLabel: {
    flex: 1,
    fontSize: 14,
  },
  nutritionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});

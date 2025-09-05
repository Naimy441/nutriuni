import { Citations } from '@/components/Citations';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MenuItem } from '@/services/MenuDatabase';
import { useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface NutritionModalProps {
  visible: boolean;
  menuItem: MenuItem | null;
  onClose: () => void;
  restaurantName?: string;
}

export function NutritionModal({ visible, menuItem, onClose, restaurantName }: NutritionModalProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme();
  const { addItem } = useNutritionTracker();
  const [isAdding, setIsAdding] = useState(false);

  // Fixed snap points with scrollable content
  const snapPoints = useMemo(() => ['25%', '60%', '90%', '100%'], []);

  // Handle sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Control sheet visibility
  useEffect(() => {
    if (visible && menuItem) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, menuItem]);

  const handleAddToDaily = async () => {
    if (!menuItem || !restaurantName) return;
    
    setIsAdding(true);
    
    try {
      await addItem(menuItem, restaurantName);
      
      Alert.alert(
        'Added to Daily Intake',
        `${menuItem.name} has been added to your daily nutrition tracking.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert(
        'Error',
        'Failed to add item to your daily intake. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAdding(false);
    }
  };

  if (!menuItem) return null;

  const renderNutritionFact = (key: string, fact: { amount: number; unit: string; daily_value_percent: number | null }) => (
    <View key={key} style={styles.nutritionRow}>
      <ThemedText style={styles.nutritionLabel}>{key}</ThemedText>
      <View style={styles.nutritionValues}>
        <ThemedText style={styles.nutritionAmount}>
          {fact.amount}{fact.unit}
        </ThemedText>
        {fact.daily_value_percent !== null && (
          <ThemedText style={styles.dailyValue}>
            {fact.daily_value_percent}% DV
          </ThemedText>
        )}
      </View>
    </View>
  );

  // Prioritized nutrients - most important first
  const primaryNutrients = [
    'Protein',
    'Total Carbohydrate',
    'Total Sugars',
    'Total Fat',
    'Dietary Fiber',
  ];

  const additionalNutrients = [
    'Saturated Fat',
    'Trans Fat',
    'Cholesterol',
    'Sodium',
    'Added Sugars',
  ];

  const allPriorityNutrients = [...primaryNutrients, ...additionalNutrients];
  const otherNutrients = Object.keys(menuItem.nutrition.nutrition_facts).filter(
    key => !allPriorityNutrients.includes(key)
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={2}
      onChange={handleSheetChanges}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={true}
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
    >
      {/* Header - Fixed outside scroll */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {menuItem.name}
            </ThemedText>
            {menuItem.is_halal && (
              <View style={styles.halalBadge}>
                <ThemedText style={styles.halalText}>Halal</ThemedText>
              </View>
            )}
          </View>
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
                {menuItem.nutrition.calories}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Serving Info - After Calories */}
          <View style={styles.servingContainer}>
            <ThemedText style={styles.servingText}>
              {menuItem.nutrition.serving_info.serving_size} • {menuItem.nutrition.serving_info.servings_per_container} servings per container
            </ThemedText>
          </View>

          {/* Primary Nutrients - Most Important */}
          <ThemedView style={styles.nutrientsContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Key Nutrients
            </ThemedText>
            <View style={styles.nutritionFacts}>
              {primaryNutrients.map(key => {
                const fact = menuItem.nutrition.nutrition_facts[key];
                return fact ? renderNutritionFact(key, fact) : null;
              })}
            </View>
          </ThemedView>

          {/* Additional Details - Combined */}
          {(additionalNutrients.some(key => menuItem.nutrition.nutrition_facts[key]) || otherNutrients.length > 0) && (
            <ThemedView style={styles.nutrientsContainer}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Additional Details
              </ThemedText>
              <View style={styles.nutritionFacts}>
                {additionalNutrients.map(key => {
                  const fact = menuItem.nutrition.nutrition_facts[key];
                  return fact ? renderNutritionFact(key, fact) : null;
                })}
                {otherNutrients.map(key => {
                  const fact = menuItem.nutrition.nutrition_facts[key];
                  return fact ? renderNutritionFact(key, fact) : null;
                })}
              </View>
            </ThemedView>
          )}

          {/* Daily Value Note */}
          <ThemedView style={styles.noteContainer}>
            <ThemedText style={styles.noteText}>
              * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
            </ThemedText>
          </ThemedView>

          {/* Medical Information Citations */}
          <Citations type="all" style={styles.citations} />

          {/* Add to Daily Intake Button */}
          {restaurantName && (
            <TouchableOpacity
              style={[styles.addToDailyButton, isAdding && styles.addToDailyButtonLoading]}
              onPress={handleAddToDaily}
              disabled={isAdding}
            >
              <Ionicons 
                name={isAdding ? "hourglass" : "add-circle"} 
                size={24} 
                color="#FFFFFF" 
                style={styles.addButtonIcon}
              />
              <ThemedText style={styles.addToDailyButtonText}>
                {isAdding ? 'Adding...' : 'Add to Daily Intake'}
              </ThemedText>
            </TouchableOpacity>
          )}
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: Colors.primary,
    flex: 1,
    fontSize: 20,
    lineHeight: 24,
    paddingVertical: 2,
  },
  halalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  halalText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
  sectionTitle: {
    marginBottom: 10,
    color: Colors.primary,
    fontSize: 16,
  },
  servingInfo: {
    gap: 8,
  },
  servingText: {
    fontSize: 13,
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
  nutritionValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nutritionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  dailyValue: {
    fontSize: 12,
    opacity: 0.7,
    minWidth: 50,
    textAlign: 'right',
  },
  noteContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  noteText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  addToDailyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  addToDailyButtonLoading: {
    opacity: 0.7,
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addToDailyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  citations: {
    marginTop: 16,
    marginBottom: 8,
  },
});

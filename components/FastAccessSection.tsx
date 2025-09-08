import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FastAccessItem, fastAccessService, useFastAccess } from '@/services/FastAccessService';
import { TrackedItem, useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AddCustomMealModal, CustomMealData } from './AddCustomMealModal';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { TrackedItemModal } from './TrackedItemModal';

export function FastAccessSection() {
  const colorScheme = useColorScheme();
  const { fastAccessItems, isLoading, refresh } = useFastAccess();
  const { addCustomMeal, addItem } = useNutritionTracker();
  const [showAddCustomMealModal, setShowAddCustomMealModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrackedItem | null>(null);
  const [showNutritionModal, setShowNutritionModal] = useState(false);

  const customMeals = fastAccessItems.filter(item => item.type === 'custom');
  const recentItems = fastAccessItems.filter(item => item.type === 'restaurant');

  const handleFastAccessItemPress = async (item: FastAccessItem) => {
    try {
      const trackedItem = fastAccessService.fastAccessItemToTrackedItem(item);
      
      if (item.type === 'custom') {
        // For custom meals, use the custom meal data format
        const customMealData: CustomMealData = {
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          sugar: item.sugar,
          sodium: item.sodium,
          serving_size: item.serving_size,
        };
        await addCustomMeal(customMealData);
      } else {
        // For restaurant items, we need to simulate a MenuItem
        const menuItem = {
          name: item.name,
          nutrition: {
            calories: item.calories,
            serving_info: {
              serving_size: item.serving_size,
            },
            nutrition_facts: {
              'Protein': { amount: item.protein },
              'Total Carbohydrate': { amount: item.carbs },
              'Total Fat': { amount: item.fat },
              'Dietary Fiber': { amount: item.fiber },
              'Total Sugars': { amount: item.sugar },
              'Sodium': { amount: item.sodium },
            }
          }
        };
        await addItem(menuItem as any, item.restaurant);
      }
      
      Alert.alert('Added!', `${item.name} has been added to today's log.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  const handleAddCustomMeal = async (mealData: CustomMealData) => {
    try {
      await addCustomMeal(mealData);
      refresh(); // Refresh the fast access items
    } catch (error) {
      Alert.alert('Error', 'Failed to add custom meal. Please try again.');
    }
  };

  const handleLongPress = (item: FastAccessItem) => {
    // Convert FastAccessItem to TrackedItem for the modal
    const trackedItem: TrackedItem = {
      id: item.id,
      name: item.name,
      restaurant: item.restaurant,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      serving_size: item.serving_size,
      timestamp: item.lastUsed,
    };
    
    setSelectedItem(trackedItem);
    setShowNutritionModal(true);
  };

  const renderFastAccessItem = (item: FastAccessItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.fastAccessItem}
      onPress={() => handleFastAccessItemPress(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={200}
    >
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemName} numberOfLines={2}>
          {item.name}
        </ThemedText>
        <View style={styles.itemDetails}>
          <ThemedText style={styles.caloriesText}>
            {item.calories} cal
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading fast access...</ThemedText>
      </ThemedView>
    );
  }

  if (fastAccessItems.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={18} color={Colors.primary} />
          <ThemedText style={styles.sectionTitle}>Quick Access</ThemedText>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={32} color="rgba(128, 128, 128, 0.5)" />
          <ThemedText style={styles.emptyText}>
            Add meals to see them here for quick access
          </ThemedText>
          <TouchableOpacity 
            style={styles.addCustomButton}
            onPress={() => setShowAddCustomMealModal(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <ThemedText style={styles.addCustomButtonText}>Add Custom Meal</ThemedText>
          </TouchableOpacity>
        </View>
        
        <AddCustomMealModal
          visible={showAddCustomMealModal}
          onClose={() => setShowAddCustomMealModal(false)}
          onSave={handleAddCustomMeal}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="flash" size={18} color={Colors.primary} />
        <ThemedText style={styles.sectionTitle}>Quick Access</ThemedText>
        <TouchableOpacity 
          style={styles.addCustomButton}
          onPress={() => setShowAddCustomMealModal(true)}
        >
          <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
          <ThemedText style={styles.addCustomButtonText}>Add Custom Meal</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Custom Meals Section */}
      {customMeals.length > 0 && (
        <View style={styles.subsection}>
          <ThemedText style={styles.subsectionTitle}>Custom Meals</ThemedText>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {customMeals.slice(0, 5).map(renderFastAccessItem)}
          </ScrollView>
        </View>
      )}

      {/* Recent Restaurant Items Section */}
      {recentItems.length > 0 && (
        <View style={styles.subsection}>
          <ThemedText style={styles.subsectionTitle}>Recent Items</ThemedText>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {recentItems.slice(0, 5).map(renderFastAccessItem)}
          </ScrollView>
        </View>
      )}

      <AddCustomMealModal
        visible={showAddCustomMealModal}
        onClose={() => setShowAddCustomMealModal(false)}
        onSave={handleAddCustomMeal}
      />

      <TrackedItemModal
        visible={showNutritionModal}
        trackedItem={selectedItem}
        onClose={() => {
          setShowNutritionModal(false);
          setSelectedItem(null);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 104, 56, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.1)',
    gap: 4,
  },
  addCustomButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  subsection: {
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.8,
  },
  horizontalScroll: {
    paddingRight: 16,
    gap: 8,
  },
  fastAccessItem: {
    width: 120,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.3)',
    flexDirection: 'column',
    minHeight: 60,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 16,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  caloriesText: {
    fontSize: 10,
    opacity: 0.8,
    fontWeight: '500',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
  loadingText: {
    textAlign: 'center',
    opacity: 0.7,
    marginVertical: 20,
  },
});

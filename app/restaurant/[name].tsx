import { NutritionModal } from '@/components/NutritionModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { menuDatabase, MenuItem, Restaurant } from '@/services/MenuDatabase';
import { useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function RestaurantPage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { addItem } = useNutritionTracker();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRestaurant();
  }, [name]);

  const loadRestaurant = async () => {
    if (!name) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const restaurantData = await menuDatabase.loadRestaurant(name);
      if (restaurantData) {
        setRestaurant(restaurantData);
      } else {
        setError('Restaurant not found');
      }
    } catch (err) {
      setError('Failed to load restaurant');
      console.error('Error loading restaurant:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const handleMenuItemPress = (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem);
    setModalVisible(true);
  };

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!restaurant) return;
    
    const itemKey = `${restaurant.name}_${menuItem.name}`;
    setAddingItems(prev => new Set(prev).add(itemKey));
    
    try {
      await addItem(menuItem, restaurant.name);
      
      // Show success feedback
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
      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
    }
  };

  const renderMenuItem = (menuItem: MenuItem) => {
    const itemKey = restaurant ? `${restaurant.name}_${menuItem.name}` : menuItem.name;
    const isAdding = addingItems.has(itemKey);

    return (
      <View key={menuItem.name} style={styles.menuItemContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleMenuItemPress(menuItem)}
        >
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemName}>{menuItem.name}</ThemedText>
            <View style={styles.menuItemDetails}>
              <ThemedText style={styles.menuItemCalories}>
                {menuItem.nutrition.calories} cal
              </ThemedText>
              <ThemedText style={styles.menuItemServing}>
                {menuItem.nutrition.serving_info.serving_size}
              </ThemedText>
              {menuItem.is_halal && (
                <View style={styles.halalBadge}>
                  <ThemedText style={styles.halalText}>Halal</ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={styles.menuItemArrow}>
            <ThemedText style={styles.arrowText}>→</ThemedText>
          </View>
        </TouchableOpacity>
        
        {/* Add Button */}
        <TouchableOpacity
          style={[styles.addButton, isAdding && styles.addButtonLoading]}
          onPress={() => handleAddItem(menuItem)}
          disabled={isAdding}
        >
          <Ionicons 
            name={isAdding ? "hourglass" : "add"} 
            size={20} 
            color="#4ECDC4" 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategory = (category: { name: string; meals: MenuItem[] }) => {
    const isExpanded = expandedCategories.has(category.name);
    
    return (
      <ThemedView key={category.name} style={styles.categoryCard}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category.name)}
        >
          <View style={styles.categoryInfo}>
            <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
            <ThemedText style={styles.categoryCount}>
              {category.meals.length} items
            </ThemedText>
          </View>
          <View style={styles.expandButton}>
            <ThemedText style={styles.expandIcon}>
              {isExpanded ? '−' : '+'}
            </ThemedText>
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.categoryContent}>
            {category.meals.map(renderMenuItem)}
          </View>
        )}
      </ThemedView>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>← Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading restaurant...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  if (error || !restaurant) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>← Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>{error || 'Restaurant not found'}</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backText}>← Back</ThemedText>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <ThemedText type="title" style={styles.restaurantTitle}>
            {restaurant.name}
          </ThemedText>
          <ThemedText style={styles.restaurantHours}>
            {restaurant.hours}
          </ThemedText>
          <ThemedText style={styles.restaurantStats}>
            {restaurant.categories.length} categories
          </ThemedText>
        </View>
      </ThemedView>

      {/* Categories */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.categoriesContainer}>
          {restaurant.categories.map(renderCategory)}
        </View>
      </ScrollView>

      {/* Bottom Sheet Modal */}
      <NutritionModal
        visible={modalVisible}
        menuItem={selectedMenuItem}
        onClose={() => {
          setModalVisible(false);
          setSelectedMenuItem(null);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#4ECDC4',
  },
  headerContent: {
    alignItems: 'center',
  },
  restaurantTitle: {
    marginBottom: 8,
    color: '#4ECDC4',
    textAlign: 'center',
  },
  restaurantHours: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 4,
    textAlign: 'center',
  },
  restaurantStats: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    padding: 16,
  },
  categoryCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7DC6F',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(247, 220, 111, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7DC6F',
  },
  categoryContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  menuItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flex: 1,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  menuItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemCalories: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  menuItemServing: {
    fontSize: 12,
    opacity: 0.7,
  },
  halalBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  halalText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  menuItemArrow: {
    marginLeft: 8,
  },
  arrowText: {
    fontSize: 16,
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  addButtonLoading: {
    opacity: 0.5,
  },
});

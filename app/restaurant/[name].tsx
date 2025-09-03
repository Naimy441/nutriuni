import { NutritionModal } from '@/components/NutritionModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { menuDatabase, MenuItem, Restaurant } from '@/services/MenuDatabase';
import { useNutritionTracker } from '@/services/NutritionTracker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function RestaurantPage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { addItem, removeItem, todaysItems } = useNutritionTracker();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [undoItem, setUndoItem] = useState<{menuItem: MenuItem, restaurantName: string, timestamp: number} | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRestaurant();
  }, [name]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

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

  const showUndoNotification = (menuItem: MenuItem, restaurantName: string) => {
    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Set undo item data
    setUndoItem({ menuItem, restaurantName, timestamp: Date.now() });
    setShowUndo(true);

    // Animate in
    Animated.timing(undoOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto hide after 4 seconds
    undoTimeoutRef.current = setTimeout(() => {
      hideUndoNotification();
    }, 4000);
  };

  const hideUndoNotification = () => {
    Animated.timing(undoOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowUndo(false);
      setUndoItem(null);
    });

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  const handleUndo = async () => {
    if (!undoItem) return;

    try {
      // Find the most recently added item that matches
      const recentItem = todaysItems
        .filter(item => item.name === undoItem.menuItem.name && item.restaurant === undoItem.restaurantName)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (recentItem) {
        await removeItem(recentItem.id);
        hideUndoNotification();
      }
    } catch (error) {
      console.error('Error undoing item:', error);
      Alert.alert('Error', 'Failed to undo. Please try removing the item manually.');
    }
  };

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!restaurant) return;
    
    const itemKey = `${restaurant.name}_${menuItem.name}`;
    setAddingItems(prev => new Set(prev).add(itemKey));
    
    try {
      await addItem(menuItem, restaurant.name);
      
      // Show undo notification instead of alert
      showUndoNotification(menuItem, restaurant.name);
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
            <View style={styles.menuItemTitleRow}>
              <ThemedText style={styles.menuItemName}>{menuItem.name}</ThemedText>
              {menuItem.is_halal && (
                <View style={styles.halalBadge}>
                  <ThemedText style={styles.halalText}>Halal</ThemedText>
                </View>
              )}
            </View>
            <View style={styles.menuItemDetails}>
              <ThemedText style={styles.menuItemCalories}>
                {menuItem.nutrition.calories} cal
              </ThemedText>
              <ThemedText style={styles.menuItemServing}>
                {menuItem.nutrition.serving_info.serving_size}
              </ThemedText>
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
            color="#FFFFFF" 
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
        restaurantName={restaurant?.name}
      />

      {/* Undo Notification */}
      {showUndo && undoItem && (
        <Animated.View 
          style={[
            styles.undoContainer,
            { opacity: undoOpacity }
          ]}
        >
          <View style={styles.undoContent}>
            <ThemedText style={styles.undoText}>
              Added {undoItem.menuItem.name}
            </ThemedText>
            <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
              <ThemedText style={styles.undoButtonText}>UNDO</ThemedText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
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
    color: Colors.primary,
  },
  headerContent: {
    alignItems: 'center',
  },
  restaurantTitle: {
    marginBottom: 8,
    color: Colors.primary,
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
    color: Colors.primary,
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
    backgroundColor: 'rgba(0, 104, 56, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
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
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  menuItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemCalories: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  menuItemServing: {
    fontSize: 12,
    opacity: 0.7,
  },
  halalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  halalText: {
    fontSize: 11,
    color: 'white',
    fontWeight: 'bold',
  },
  menuItemArrow: {
    marginLeft: 8,
    marginTop: -8,
  },
  arrowText: {
    fontSize: 20,
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
    color: Colors.primary,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLoading: {
    opacity: 0.5,
  },
  undoContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#323232',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  undoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  undoButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

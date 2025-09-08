// Fast Access Service - Manage recently added meals and custom meals for quick access
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem } from './NutritionTracker';

export interface FastAccessItem {
  id: string;
  name: string;
  restaurant: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  serving_size: string;
  type: 'custom' | 'restaurant';
  lastUsed: number;
  useCount: number;
}

class FastAccessService {
  private static instance: FastAccessService;
  private fastAccessItems: FastAccessItem[] = [];
  private maxItems = 10; // Maximum number of items to keep

  static getInstance(): FastAccessService {
    if (!FastAccessService.instance) {
      FastAccessService.instance = new FastAccessService();
    }
    return FastAccessService.instance;
  }

  async loadFastAccessItems(): Promise<FastAccessItem[]> {
    try {
      const stored = await AsyncStorage.getItem('fast_access_items');
      if (stored) {
        this.fastAccessItems = JSON.parse(stored);
        // Sort by lastUsed descending, then by useCount descending
        this.fastAccessItems.sort((a, b) => {
          if (b.lastUsed !== a.lastUsed) {
            return b.lastUsed - a.lastUsed;
          }
          return b.useCount - a.useCount;
        });
      }
      return this.fastAccessItems;
    } catch (error) {
      console.error('Error loading fast access items:', error);
      return [];
    }
  }

  async addOrUpdateFastAccessItem(trackedItem: TrackedItem): Promise<void> {
    try {
      // Load current items if not loaded
      if (this.fastAccessItems.length === 0) {
        await this.loadFastAccessItems();
      }

      // Check if item already exists (by name and restaurant)
      const existingIndex = this.fastAccessItems.findIndex(
        item => item.name === trackedItem.name && item.restaurant === trackedItem.restaurant
      );

      if (existingIndex >= 0) {
        // Update existing item
        this.fastAccessItems[existingIndex] = {
          ...this.fastAccessItems[existingIndex],
          lastUsed: Date.now(),
          useCount: this.fastAccessItems[existingIndex].useCount + 1,
          // Update nutrition info in case it changed
          calories: trackedItem.calories,
          protein: trackedItem.protein,
          carbs: trackedItem.carbs,
          fat: trackedItem.fat,
          fiber: trackedItem.fiber,
          sugar: trackedItem.sugar,
          sodium: trackedItem.sodium,
          serving_size: trackedItem.serving_size,
        };
      } else {
        // Add new item
        const fastAccessItem: FastAccessItem = {
          id: trackedItem.id,
          name: trackedItem.name,
          restaurant: trackedItem.restaurant,
          calories: trackedItem.calories,
          protein: trackedItem.protein,
          carbs: trackedItem.carbs,
          fat: trackedItem.fat,
          fiber: trackedItem.fiber,
          sugar: trackedItem.sugar,
          sodium: trackedItem.sodium,
          serving_size: trackedItem.serving_size,
          type: trackedItem.restaurant === 'Custom Meal' ? 'custom' : 'restaurant',
          lastUsed: Date.now(),
          useCount: 1,
        };

        this.fastAccessItems.unshift(fastAccessItem);
      }

      // Keep only the most recent/frequently used items
      if (this.fastAccessItems.length > this.maxItems) {
        this.fastAccessItems = this.fastAccessItems.slice(0, this.maxItems);
      }

      // Sort by lastUsed descending, then by useCount descending
      this.fastAccessItems.sort((a, b) => {
        if (b.lastUsed !== a.lastUsed) {
          return b.lastUsed - a.lastUsed;
        }
        return b.useCount - a.useCount;
      });

      // Save to storage
      await AsyncStorage.setItem('fast_access_items', JSON.stringify(this.fastAccessItems));
    } catch (error) {
      console.error('Error adding/updating fast access item:', error);
      throw error;
    }
  }

  async getFastAccessItems(): Promise<FastAccessItem[]> {
    if (this.fastAccessItems.length === 0) {
      await this.loadFastAccessItems();
    }
    return this.fastAccessItems;
  }

  async getCustomMeals(): Promise<FastAccessItem[]> {
    const items = await this.getFastAccessItems();
    return items.filter(item => item.type === 'custom');
  }

  async getRecentRestaurantItems(): Promise<FastAccessItem[]> {
    const items = await this.getFastAccessItems();
    return items.filter(item => item.type === 'restaurant');
  }

  async removeFastAccessItem(itemId: string): Promise<void> {
    try {
      this.fastAccessItems = this.fastAccessItems.filter(item => item.id !== itemId);
      await AsyncStorage.setItem('fast_access_items', JSON.stringify(this.fastAccessItems));
    } catch (error) {
      console.error('Error removing fast access item:', error);
      throw error;
    }
  }

  async clearAllFastAccessItems(): Promise<void> {
    try {
      this.fastAccessItems = [];
      await AsyncStorage.removeItem('fast_access_items');
    } catch (error) {
      console.error('Error clearing fast access items:', error);
      throw error;
    }
  }

  // Convert FastAccessItem back to TrackedItem format for adding to nutrition tracker
  fastAccessItemToTrackedItem(fastAccessItem: FastAccessItem): TrackedItem {
    return {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate new ID
      name: fastAccessItem.name,
      restaurant: fastAccessItem.restaurant,
      calories: fastAccessItem.calories,
      protein: fastAccessItem.protein,
      carbs: fastAccessItem.carbs,
      fat: fastAccessItem.fat,
      fiber: fastAccessItem.fiber,
      sugar: fastAccessItem.sugar,
      sodium: fastAccessItem.sodium,
      serving_size: fastAccessItem.serving_size,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const fastAccessService = FastAccessService.getInstance();

// React Hook for using fast access
export function useFastAccess() {
  const [fastAccessItems, setFastAccessItems] = React.useState<FastAccessItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const items = await fastAccessService.getFastAccessItems();
      setFastAccessItems(items);
    } catch (error) {
      console.error('Error loading fast access items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (trackedItem: TrackedItem) => {
    try {
      await fastAccessService.addOrUpdateFastAccessItem(trackedItem);
      await loadItems(); // Refresh data
    } catch (error) {
      console.error('Error adding fast access item:', error);
      throw error;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await fastAccessService.removeFastAccessItem(itemId);
      await loadItems(); // Refresh data
    } catch (error) {
      console.error('Error removing fast access item:', error);
      throw error;
    }
  };

  const clearAll = async () => {
    try {
      await fastAccessService.clearAllFastAccessItems();
      await loadItems(); // Refresh data
    } catch (error) {
      console.error('Error clearing fast access items:', error);
      throw error;
    }
  };

  // Load data on mount
  React.useEffect(() => {
    loadItems();
  }, []);

  return {
    fastAccessItems,
    isLoading,
    addItem,
    removeItem,
    clearAll,
    refresh: loadItems,
  };
}

import React from 'react';

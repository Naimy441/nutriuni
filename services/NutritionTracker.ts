// Nutrition Tracking Service - Track daily intake
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { MenuItem } from './MenuDatabase';

export interface DailyNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface TrackedItem {
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
  timestamp: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD format
  items: TrackedItem[];
  totals: DailyNutrition;
}

class NutritionTrackerService {
  private static instance: NutritionTrackerService;
  private currentDate: string;
  private dailyLog: DailyLog | null = null;

  static getInstance(): NutritionTrackerService {
    if (!NutritionTrackerService.instance) {
      NutritionTrackerService.instance = new NutritionTrackerService();
    }
    return NutritionTrackerService.instance;
  }

  constructor() {
    this.currentDate = this.getTodayString();
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private generateItemId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractNutritionFromMenuItem(menuItem: MenuItem, restaurant: string): TrackedItem {
    const nutrition = menuItem.nutrition;
    
    // Parse calories (might be string)
    const calories = typeof nutrition.calories === 'string' 
      ? parseInt(nutrition.calories) || 0 
      : nutrition.calories || 0;

    // Extract nutrition facts with safe parsing
    const getNutrientAmount = (key: string): number => {
      const nutrient = nutrition.nutrition_facts[key];
      return nutrient ? nutrient.amount || 0 : 0;
    };

    return {
      id: this.generateItemId(),
      name: menuItem.name,
      restaurant,
      calories,
      protein: getNutrientAmount('Protein'),
      carbs: getNutrientAmount('Total Carbohydrate'),
      fat: getNutrientAmount('Total Fat'),
      fiber: getNutrientAmount('Dietary Fiber'),
      sugar: getNutrientAmount('Total Sugars'),
      sodium: getNutrientAmount('Sodium'),
      serving_size: nutrition.serving_info.serving_size,
      timestamp: Date.now(),
    };
  }

  private calculateTotals(items: TrackedItem[]): DailyNutrition {
    return items.reduce((totals, item) => ({
      calories: totals.calories + item.calories,
      protein: totals.protein + item.protein,
      carbs: totals.carbs + item.carbs,
      fat: totals.fat + item.fat,
      fiber: totals.fiber + item.fiber,
      sugar: totals.sugar + item.sugar,
      sodium: totals.sodium + item.sodium,
    }), {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    });
  }

  async loadTodaysLog(): Promise<DailyLog> {
    const today = this.getTodayString();
    
    // If date changed, reset
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.dailyLog = null;
    }

    // Return cached if available
    if (this.dailyLog && this.dailyLog.date === today) {
      return this.dailyLog;
    }

    try {
      const stored = await AsyncStorage.getItem(`nutrition_log_${today}`);
      if (stored) {
        this.dailyLog = JSON.parse(stored);
        return this.dailyLog!;
      }
    } catch (error) {
      console.error('Error loading daily log:', error);
    }

    // Create new log for today
    this.dailyLog = {
      date: today,
      items: [],
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      },
    };

    return this.dailyLog;
  }

  async addMenuItem(menuItem: MenuItem, restaurant: string): Promise<void> {
    const todaysLog = await this.loadTodaysLog();
    const trackedItem = this.extractNutritionFromMenuItem(menuItem, restaurant);
    
    todaysLog.items.push(trackedItem);
    todaysLog.totals = this.calculateTotals(todaysLog.items);
    
    // Save to storage
    try {
      await AsyncStorage.setItem(
        `nutrition_log_${this.currentDate}`,
        JSON.stringify(todaysLog)
      );
      this.dailyLog = todaysLog;
    } catch (error) {
      console.error('Error saving daily log:', error);
      throw error;
    }
  }

  async removeItem(itemId: string): Promise<void> {
    const todaysLog = await this.loadTodaysLog();
    todaysLog.items = todaysLog.items.filter(item => item.id !== itemId);
    todaysLog.totals = this.calculateTotals(todaysLog.items);
    
    try {
      await AsyncStorage.setItem(
        `nutrition_log_${this.currentDate}`,
        JSON.stringify(todaysLog)
      );
      this.dailyLog = todaysLog;
    } catch (error) {
      console.error('Error saving daily log:', error);
      throw error;
    }
  }

  async getTodaysNutrition(): Promise<DailyNutrition> {
    const todaysLog = await this.loadTodaysLog();
    return todaysLog.totals;
  }

  async getTodaysItems(): Promise<TrackedItem[]> {
    const todaysLog = await this.loadTodaysLog();
    return todaysLog.items;
  }

  async clearTodaysLog(): Promise<void> {
    const today = this.getTodayString();
    try {
      await AsyncStorage.removeItem(`nutrition_log_${today}`);
      this.dailyLog = {
        date: today,
        items: [],
        totals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
        },
      };
    } catch (error) {
      console.error('Error clearing daily log:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const nutritionTracker = NutritionTrackerService.getInstance();

// React Hook for using the nutrition tracker
export function useNutritionTracker() {
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });
  const [todaysItems, setTodaysItems] = useState<TrackedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [nutrition, items] = await Promise.all([
        nutritionTracker.getTodaysNutrition(),
        nutritionTracker.getTodaysItems(),
      ]);
      setDailyNutrition(nutrition);
      setTodaysItems(items);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (menuItem: MenuItem, restaurant: string) => {
    try {
      await nutritionTracker.addMenuItem(menuItem, restaurant);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await nutritionTracker.removeItem(itemId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  };

  const clearAll = async () => {
    try {
      await nutritionTracker.clearTodaysLog();
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error clearing log:', error);
      throw error;
    }
  };

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, []);

  return {
    dailyNutrition,
    todaysItems,
    isLoading,
    addItem,
    removeItem,
    clearAll,
    refresh: loadData,
  };
}

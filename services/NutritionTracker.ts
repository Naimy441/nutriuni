// Nutrition Tracking Service - Track daily intake
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { fastAccessService } from './FastAccessService';
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
  private midnightTimeout: ReturnType<typeof setTimeout> | null = null;
  private dateChangeCallbacks: (() => void)[] = [];
  private appStateSubscription: any = null;

  static getInstance(): NutritionTrackerService {
    if (!NutritionTrackerService.instance) {
      NutritionTrackerService.instance = new NutritionTrackerService();
    }
    return NutritionTrackerService.instance;
  }

  constructor() {
    this.currentDate = this.getTodayString();
    const now = new Date();
    this.setupSmartDateDetection();
  }

  // Smart date detection: precise midnight timer + app state monitoring
  private setupSmartDateDetection() {
    this.setupMidnightTimer();
    this.setupAppStateMonitoring();
  }

  // Calculate exact time until midnight and set precise timer
  private setupMidnightTimer() {
    // Clear existing timeout
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
    }

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight
    
    const msUntilMidnight = midnight.getTime() - now.getTime();
    
    this.midnightTimeout = setTimeout(async () => {
      await this.checkForDateChange();
      // Setup timer for next day
      this.setupMidnightTimer();
    }, msUntilMidnight);
  }

  // Setup app state monitoring to check date when app becomes active
  private setupAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        // Save timestamp when app goes to background
        await this.saveBackgroundTimestamp();
      } else if (nextAppState === 'active') {
        await this.checkForDateChangeFromBackground();
      }
    });
  }

  // Save timestamp when app goes to background
  private async saveBackgroundTimestamp(): Promise<void> {
    try {
      const timestamp = Date.now();
      await AsyncStorage.setItem('app_background_timestamp', timestamp.toString());
    } catch (error) {
      console.error('Error saving background timestamp:', error);
    }
  }

  // Check for date change when returning from background
  private async checkForDateChangeFromBackground(): Promise<void> {
    try {
      const backgroundTimestamp = await AsyncStorage.getItem('app_background_timestamp');
      
      if (backgroundTimestamp) {
        const backgroundTime = new Date(parseInt(backgroundTimestamp));
        const currentTime = new Date();
        
        // Check if we crossed midnight while backgrounded
        const backgroundDate = backgroundTime.toISOString().split('T')[0];
        const currentDate = currentTime.toISOString().split('T')[0];
        
        if (backgroundDate !== currentDate) {
          // Force date change processing
          await this.checkForDateChange();
          
          // Reset the midnight timer since we may have missed it
          this.setupMidnightTimer();
        } else {
          // Still check in case this.currentDate is out of sync
          const actualDateChange = await this.checkForDateChange();
        }
        
        // Clean up the background timestamp
        await AsyncStorage.removeItem('app_background_timestamp');
      } else {
        // No background timestamp, just do regular check
        await this.checkForDateChange();
      }
    } catch (error) {
      console.error('Error checking date change from background:', error);
      // Fallback to regular date check
      await this.checkForDateChange();
    }
  }

  // Check if the date has changed and notify listeners
  private async checkForDateChange(): Promise<boolean> {
    const newDate = this.getTodayString();
    const now = new Date();
    if (this.currentDate !== newDate) {
      // Check if this is a backwards time change (clock set back)
      const currentDateObj = new Date(this.currentDate + 'T00:00:00');
      const newDateObj = new Date(newDate + 'T00:00:00');
      
      if (newDateObj < currentDateObj) {
        // Just sync the date without moving items to history
        this.currentDate = newDate;
        return false; // No actual date change processed
      }
      
      const oldDate = this.currentDate;
      
      // Save current day's data to history before switching to new day
      await this.saveCurrentDayToHistory(oldDate);
      
      // Switch to new day
      this.currentDate = newDate;
      this.dailyLog = null; // Reset daily log for new day
      
      // Notify all registered callbacks
      this.dateChangeCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in date change callback:', error);
        }
      });
      
      return true; // Date changed
    }
    return false; // No change
  }

  // Save current day's data to history before switching to new day
  private async saveCurrentDayToHistory(dateString: string): Promise<void> {
    try {
      // If we have current daily log data, save it
      if (this.dailyLog && this.dailyLog.items.length > 0) {

        // Ensure the log has the correct date
        const finalLog = {
          ...this.dailyLog,
          date: dateString,
        };
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(`nutrition_log_${dateString}`, JSON.stringify(finalLog));
      } else {
      }
    } catch (error) {
      console.error(`❌ Error saving day ${dateString} to history:`, error);
    }
  }

  // Public method to force check for date change (useful for app focus events)
  public async forceCheckDateChange(): Promise<boolean> {
    return await this.checkForDateChange();
  }


  // Register a callback to be called when date changes
  public onDateChange(callback: () => void) {
    this.dateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.dateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.dateChangeCallbacks.splice(index, 1);
      }
    };
  }

  // Clean up timers when service is destroyed
  public destroy() {
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
      this.midnightTimeout = null;
    }
    // Clean up AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.dateChangeCallbacks = [];
  }

  private getTodayString(): string {
    const today = new Date();
    // Use local date instead of UTC to avoid timezone issues
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      
      // Add to fast access for quick re-adding
      await fastAccessService.addOrUpdateFastAccessItem(trackedItem);
    } catch (error) {
      console.error('Error saving daily log:', error);
      throw error;
    }
  }

  async addCustomMeal(customMeal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    serving_size: string;
  }): Promise<void> {
    const todaysLog = await this.loadTodaysLog();
    
    const trackedItem: TrackedItem = {
      id: this.generateItemId(),
      name: customMeal.name,
      restaurant: 'Custom Meal',
      calories: customMeal.calories,
      protein: customMeal.protein,
      carbs: customMeal.carbs,
      fat: customMeal.fat,
      fiber: customMeal.fiber,
      sugar: customMeal.sugar,
      sodium: customMeal.sodium,
      serving_size: customMeal.serving_size,
      timestamp: Date.now(),
    };
    
    todaysLog.items.push(trackedItem);
    todaysLog.totals = this.calculateTotals(todaysLog.items);
    
    // Save to storage
    try {
      await AsyncStorage.setItem(
        `nutrition_log_${this.currentDate}`,
        JSON.stringify(todaysLog)
      );
      this.dailyLog = todaysLog;
      
      // Add to fast access for quick re-adding
      await fastAccessService.addOrUpdateFastAccessItem(trackedItem);
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

  // Get historical data for a specific date
  async getDayLog(dateString: string): Promise<DailyLog | null> {
    try {
      const stored = await AsyncStorage.getItem(`nutrition_log_${dateString}`);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error loading day log:', error);
      return null;
    }
  }

  // Get logs for the past N days (not including today)
  async getPastDaysLogs(days: number): Promise<DailyLog[]> {
    const logs: DailyLog[] = [];
    const today = new Date();
    
    for (let i = 1; i <= days; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const dateString = this.formatDateFromDate(pastDate);
      
      const log = await this.getDayLog(dateString);
      if (log) {
        logs.push(log);
      }
    }
    
    return logs;
  }

  // Get the most recent N logs with actual data (regardless of date gaps)
  async getMostRecentLogs(count: number): Promise<DailyLog[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const nutritionLogKeys = keys.filter(key => key.startsWith('nutrition_log_'));
      const today = this.getTodayString();
      
      // Exclude today's log from history
      const historicalKeys = nutritionLogKeys.filter(key => key !== `nutrition_log_${today}`);
      
      const logs: DailyLog[] = [];
      for (const key of historicalKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const log = JSON.parse(stored);
            // Only include logs that have actual food items
            if (log.items && log.items.length > 0) {
              logs.push(log);
            }
          }
        } catch (error) {
          console.error(`Error loading log for key ${key}:`, error);
        }
      }
      
      // Sort by date (most recent first) and take only the requested count
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return logs.slice(0, count);
    } catch (error) {
      console.error('Error loading most recent logs:', error);
      return [];
    }
  }

  // Helper method to format date from Date object using local time
  private formatDateFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Get all available historical logs
  async getAllHistoricalLogs(): Promise<DailyLog[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const nutritionLogKeys = keys.filter(key => key.startsWith('nutrition_log_'));
      const today = this.getTodayString();
      
      // Exclude today's log from history
      const historicalKeys = nutritionLogKeys.filter(key => key !== `nutrition_log_${today}`);
      
      const logs: DailyLog[] = [];
      for (const key of historicalKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const log = JSON.parse(stored);
            logs.push(log);
          }
        } catch (error) {
          console.error(`Error loading log for key ${key}:`, error);
        }
      }
      
      // Sort by date (most recent first)
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return logs;
    } catch (error) {
      console.error('Error loading historical logs:', error);
      return [];
    }
  }

  // Format date for display
  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
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

  const addCustomMeal = async (customMeal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    serving_size: string;
  }) => {
    try {
      await nutritionTracker.addCustomMeal(customMeal);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error adding custom meal:', error);
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

  // Load data on mount and listen for date changes
  React.useEffect(() => {
    loadData();
    
    // Subscribe to date changes
    const unsubscribe = nutritionTracker.onDateChange(() => {
      loadData();
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  return {
    dailyNutrition,
    todaysItems,
    isLoading,
    addItem,
    addCustomMeal,
    removeItem,
    clearAll,
    refresh: loadData,
  };
}

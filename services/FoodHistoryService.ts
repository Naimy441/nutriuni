// Food History Service - Manage historical nutrition data and provide hooks for UI
import { useCallback, useEffect, useState } from 'react';
import { DailyLog, nutritionTracker } from './NutritionTracker';

export interface HistoryDay {
  date: string;
  displayDate: string;
  log: DailyLog;
  isExpanded: boolean;
}

class FoodHistoryService {
  private static instance: FoodHistoryService;

  static getInstance(): FoodHistoryService {
    if (!FoodHistoryService.instance) {
      FoodHistoryService.instance = new FoodHistoryService();
    }
    return FoodHistoryService.instance;
  }

  // Get the most recent 3 days with food data (regardless of gaps)
  async getPastThreeDays(): Promise<HistoryDay[]> {
    try {
      const logs = await nutritionTracker.getMostRecentLogs(3);
      return logs.map(log => ({
        date: log.date,
        displayDate: nutritionTracker.formatDateForDisplay(log.date),
        log,
        isExpanded: false,
      }));
    } catch (error) {
      console.error('Error loading most recent days:', error);
      return [];
    }
  }

  // Get all historical data
  async getAllHistory(): Promise<HistoryDay[]> {
    try {
      const logs = await nutritionTracker.getAllHistoricalLogs();
      return logs.map(log => ({
        date: log.date,
        displayDate: nutritionTracker.formatDateForDisplay(log.date),
        log,
        isExpanded: false,
      }));
    } catch (error) {
      console.error('Error loading all history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const foodHistoryService = FoodHistoryService.getInstance();

// React Hook for using food history
export function useFoodHistory() {
  const [pastThreeDays, setPastThreeDays] = useState<HistoryDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPastThreeDays = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const history = await foodHistoryService.getPastThreeDays();
      setPastThreeDays(history);
    } catch (err) {
      console.error('Error loading food history:', err);
      setError('Failed to load food history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleDayExpansion = useCallback((dateString: string) => {
    setPastThreeDays(prev => 
      prev.map(day => 
        day.date === dateString 
          ? { ...day, isExpanded: !day.isExpanded }
          : day
      )
    );
  }, []);

  // Load data on mount and listen for date changes
  useEffect(() => {
    loadPastThreeDays();
    
    // Subscribe to date changes to refresh history
    const unsubscribe = nutritionTracker.onDateChange(() => {
      loadPastThreeDays();
    });
    
    return unsubscribe;
  }, []);

  return {
    pastThreeDays,
    isLoading,
    error,
    toggleDayExpansion,
    refresh: loadPastThreeDays,
  };
}

// Hook for all history (used in modal/separate screen)
export function useAllFoodHistory() {
  const [allHistory, setAllHistory] = useState<HistoryDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const history = await foodHistoryService.getAllHistory();
      setAllHistory(history);
    } catch (err) {
      console.error('Error loading all food history:', err);
      setError('Failed to load food history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleDayExpansion = useCallback((dateString: string) => {
    setAllHistory(prev => 
      prev.map(day => 
        day.date === dateString 
          ? { ...day, isExpanded: !day.isExpanded }
          : day
      )
    );
  }, []);

  return {
    allHistory,
    isLoading,
    error,
    toggleDayExpansion,
    loadAllHistory,
  };
}

// Menu Database Service - Efficient restaurant-based loading with index
import { useEffect, useState } from 'react';

export interface NutritionFacts {
  'Total Fat': { amount: number; unit: string; daily_value_percent: number | null };
  'Saturated Fat': { amount: number; unit: string; daily_value_percent: number | null };
  'Trans Fat': { amount: number; unit: string; daily_value_percent: number | null };
  'Cholesterol': { amount: number; unit: string; daily_value_percent: number | null };
  'Sodium': { amount: number; unit: string; daily_value_percent: number | null };
  'Total Carbohydrate': { amount: number; unit: string; daily_value_percent: number | null };
  'Dietary Fiber': { amount: number; unit: string; daily_value_percent: number | null };
  'Total Sugars': { amount: number; unit: string; daily_value_percent: number | null };
  'Added Sugars': { amount: number; unit: string; daily_value_percent: number | null };
  'Protein': { amount: number; unit: string; daily_value_percent: number | null };
  [key: string]: any;
}

export interface MenuItem {
  name: string;
  is_halal: boolean;
  nutrition: {
    item_name: string;
    serving_info: {
      servings_per_container: number;
      serving_size: string;
    };
    calories: string;
    nutrition_facts: NutritionFacts;
  };
}

export interface MenuCategory {
  name: string;
  meals: MenuItem[];
}

export interface Restaurant {
  name: string;
  hours: string;
  categories: MenuCategory[];
}

export interface RestaurantIndex {
  created_at: string;
  total_restaurants: number;
  restaurants: {
    [key: string]: {
      filename: string;
      safe_name: string;
      hours: string;
      total_items: number;
      halal_items: number;
      categories_count: number;
    };
  };
}

export interface RestaurantInfo {
  name: string;
  filename: string;
  safe_name: string;
  hours: string;
  total_items: number;
  halal_items: number;
  categories_count: number;
}

// Simplified food item for easier consumption
export interface SimplifiedFoodItem {
  id: string;
  name: string;
  restaurant: string;
  category: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  serving_size: string;
  is_halal: boolean;
}

class MenuDatabaseService {
  private static instance: MenuDatabaseService;
  private restaurantIndex: RestaurantIndex | null = null;
  private restaurantData: Map<string, Restaurant> = new Map();
  private restaurantFoods: Map<string, SimplifiedFoodItem[]> = new Map();
  private isLoading = false;
  private loadedRestaurants = new Set<string>();

  static getInstance(): MenuDatabaseService {
    if (!MenuDatabaseService.instance) {
      MenuDatabaseService.instance = new MenuDatabaseService();
    }
    return MenuDatabaseService.instance;
  }

  // Load restaurant index (lightweight - just metadata)
  async loadRestaurantIndex(): Promise<RestaurantInfo[]> {
    if (this.restaurantIndex) {
      return this.convertIndexToRestaurantInfo(this.restaurantIndex);
    }

    if (this.isLoading) {
      // Wait for loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.restaurantIndex ? this.convertIndexToRestaurantInfo(this.restaurantIndex) : [];
    }

    this.isLoading = true;
    try {
      const indexData = require('../assets/restaurants/index.json') as RestaurantIndex;
      this.restaurantIndex = indexData;
      
      console.log(`Loaded index for ${indexData.total_restaurants} restaurants`);
      return this.convertIndexToRestaurantInfo(indexData);
    } catch (error) {
      console.error('Failed to load restaurant index:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  // Static restaurant data mapping (React Native doesn't support dynamic requires)
  private getRestaurantData(filename: string): any {
    const restaurantFiles: { [key: string]: any } = {
      'bella_union.json': require('../assets/restaurants/bella_union.json'),
      'beyu_blue_coffee.json': require('../assets/restaurants/beyu_blue_coffee.json'),
      'bseisu_coffee_bar.json': require('../assets/restaurants/bseisu_coffee_bar.json'),
      'cafe.json': require('../assets/restaurants/cafe.json'),
      'duke_marine_lab.json': require('../assets/restaurants/duke_marine_lab.json'),
      'ginger_soy.json': require('../assets/restaurants/ginger_soy.json'),
      'gothic_grill.json': require('../assets/restaurants/gothic_grill.json'),
      'gyotaku.json': require('../assets/restaurants/gyotaku.json'),
      'il_forno.json': require('../assets/restaurants/il_forno.json'),
      'jbs_roast_chops.json': require('../assets/restaurants/jbs_roast_chops.json'),
      'marketplace.json': require('../assets/restaurants/marketplace.json'),
      'red_mango.json': require('../assets/restaurants/red_mango.json'),
      'saladalia_the_perk.json': require('../assets/restaurants/saladalia_the_perk.json'),
      'sanford_deli.json': require('../assets/restaurants/sanford_deli.json'),
      'sazon.json': require('../assets/restaurants/sazon.json'),
      'sprout.json': require('../assets/restaurants/sprout.json'),
      'tandoor_indian_cuisine.json': require('../assets/restaurants/tandoor_indian_cuisine.json'),
      'the_devils_krafthouse.json': require('../assets/restaurants/the_devils_krafthouse.json'),
      'the_farmstead.json': require('../assets/restaurants/the_farmstead.json'),
      'the_pitchfork.json': require('../assets/restaurants/the_pitchfork.json'),
      'the_skillet.json': require('../assets/restaurants/the_skillet.json'),
      'trinity_cafe.json': require('../assets/restaurants/trinity_cafe.json'),
      'twinnies.json': require('../assets/restaurants/twinnies.json'),
      'zwelis_cafe_at_duke_divinity.json': require('../assets/restaurants/zwelis_cafe_at_duke_divinity.json'),
    };

    return restaurantFiles[filename] || null;
  }

  // Helper method to convert index to RestaurantInfo array
  private convertIndexToRestaurantInfo(indexData: RestaurantIndex): RestaurantInfo[] {
    return Object.entries(indexData.restaurants).map(([name, info]) => ({
      name,
      filename: info.filename,
      safe_name: info.safe_name,
      hours: info.hours,
      total_items: info.total_items,
      halal_items: info.halal_items,
      categories_count: info.categories_count,
    }));
  }

  // Get restaurant list (just names)
  async getRestaurantNames(): Promise<string[]> {
    const restaurants = await this.loadRestaurantIndex();
    return restaurants.map(r => r.name);
  }

  // Load specific restaurant data from individual file (only when needed)
  async loadRestaurant(restaurantName: string): Promise<Restaurant | null> {
    // Return cached if already loaded
    if (this.restaurantData.has(restaurantName)) {
      return this.restaurantData.get(restaurantName)!;
    }

    // Load restaurant index if not loaded
    if (!this.restaurantIndex) {
      await this.loadRestaurantIndex();
    }

    if (!this.restaurantIndex) return null;

    const restaurantInfo = this.restaurantIndex.restaurants[restaurantName];
    if (!restaurantInfo) {
      console.error(`Restaurant "${restaurantName}" not found in index`);
      return null;
    }

    try {
      // Load individual restaurant file using static imports
      const restaurantData = this.getRestaurantData(restaurantInfo.filename);
      if (!restaurantData) {
        throw new Error(`Restaurant data not found for ${restaurantInfo.filename}`);
      }
      
      const restaurant: Restaurant = {
        name: restaurantName,
        hours: restaurantInfo.hours,
        categories: restaurantData.categories || [],
      };

      this.restaurantData.set(restaurantName, restaurant);
      this.loadedRestaurants.add(restaurantName);
      
      // Convert to simplified food items for easier searching
      this.buildRestaurantFoodIndex(restaurant);
      
      console.log(`Loaded restaurant: ${restaurantName} with ${restaurant.categories.length} categories`);
      return restaurant;
    } catch (error) {
      console.error(`Failed to load restaurant file: ${restaurantInfo.filename}`, error);
      return null;
    }
  }

  // Convert restaurant data to simplified food items
  private buildRestaurantFoodIndex(restaurant: Restaurant): void {
    const foods: SimplifiedFoodItem[] = [];
    let itemId = 0;

    restaurant.categories.forEach(category => {
      category.meals.forEach(meal => {
        const nutrition = meal.nutrition.nutrition_facts;
        
        const food: SimplifiedFoodItem = {
          id: `${restaurant.name.toLowerCase().replace(/\s+/g, '_')}_${itemId++}`,
          name: meal.name,
          restaurant: restaurant.name,
          category: category.name,
          calories: parseInt(meal.nutrition.calories) || 0,
          protein_g: nutrition['Protein']?.amount || 0,
          carbs_g: nutrition['Total Carbohydrate']?.amount || 0,
          fat_g: nutrition['Total Fat']?.amount || 0,
          fiber_g: nutrition['Dietary Fiber']?.amount || 0,
          sugar_g: nutrition['Total Sugars']?.amount || 0,
          sodium_mg: nutrition['Sodium']?.amount || 0,
          serving_size: meal.nutrition.serving_info.serving_size,
          is_halal: meal.is_halal,
        };

        foods.push(food);
      });
    });

    this.restaurantFoods.set(restaurant.name, foods);
  }

  // Search foods in specific restaurant(s)
  async searchFoodsInRestaurant(
    restaurantName: string, 
    query: string, 
    limit: number = 20
  ): Promise<SimplifiedFoodItem[]> {
    await this.loadRestaurant(restaurantName);
    
    const foods = this.restaurantFoods.get(restaurantName) || [];
    if (!query || query.length < 2) return foods.slice(0, limit);

    const searchTerm = query.toLowerCase();
    return foods
      .filter(food => 
        food.name.toLowerCase().includes(searchTerm) ||
        food.category.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => {
        // Prioritize exact matches in name
        const aExact = a.name.toLowerCase().includes(searchTerm) ? 0 : 1;
        const bExact = b.name.toLowerCase().includes(searchTerm) ? 0 : 1;
        return aExact - bExact;
      })
      .slice(0, limit);
  }

  // Search across multiple restaurants
  async searchFoodsAcrossRestaurants(
    restaurantNames: string[], 
    query: string, 
    limit: number = 20
  ): Promise<SimplifiedFoodItem[]> {
    // Load all specified restaurants
    await Promise.all(restaurantNames.map(name => this.loadRestaurant(name)));
    
    const allResults: SimplifiedFoodItem[] = [];
    
    for (const restaurantName of restaurantNames) {
      const results = await this.searchFoodsInRestaurant(restaurantName, query, limit);
      allResults.push(...results);
    }

    // Sort and limit combined results
    const searchTerm = query.toLowerCase();
    return allResults
      .sort((a, b) => {
        const aExact = a.name.toLowerCase().includes(searchTerm) ? 0 : 1;
        const bExact = b.name.toLowerCase().includes(searchTerm) ? 0 : 1;
        return aExact - bExact;
      })
      .slice(0, limit);
  }

  // Get foods by category in a restaurant
  async getFoodsByCategory(
    restaurantName: string, 
    categoryName: string, 
    limit: number = 50
  ): Promise<SimplifiedFoodItem[]> {
    await this.loadRestaurant(restaurantName);
    
    const foods = this.restaurantFoods.get(restaurantName) || [];
    return foods
      .filter(food => food.category === categoryName)
      .slice(0, limit);
  }

  // Get all categories for a restaurant
  async getRestaurantCategories(restaurantName: string): Promise<string[]> {
    const restaurant = await this.loadRestaurant(restaurantName);
    return restaurant?.categories.map(c => c.name) || [];
  }

  // Get restaurant info
  async getRestaurantInfo(restaurantName: string): Promise<{ name: string; hours: string; categoriesCount: number } | null> {
    const restaurant = await this.loadRestaurant(restaurantName);
    if (!restaurant) return null;

    return {
      name: restaurant.name,
      hours: restaurant.hours,
      categoriesCount: restaurant.categories.length,
    };
  }

  // Get popular items from a restaurant (first N items)
  async getPopularFoods(restaurantName: string, limit: number = 10): Promise<SimplifiedFoodItem[]> {
    await this.loadRestaurant(restaurantName);
    
    const foods = this.restaurantFoods.get(restaurantName) || [];
    return foods.slice(0, limit);
  }

  // Get specific food by ID
  async getFoodById(foodId: string): Promise<SimplifiedFoodItem | null> {
    // Extract restaurant name from ID
    const restaurantKey = foodId.split('_')[0];
    const restaurants = await this.getRestaurantNames();
    const restaurantName = restaurants.find((name: string) => 
      name.toLowerCase().replace(/\s+/g, '_') === restaurantKey
    );

    if (!restaurantName) return null;

    await this.loadRestaurant(restaurantName);
    const foods = this.restaurantFoods.get(restaurantName) || [];
    return foods.find(food => food.id === foodId) || null;
  }

  // Get stats
  getStats(): { 
    totalRestaurants: number; 
    loadedRestaurants: number; 
    totalLoadedFoods: number;
  } {
    const totalLoadedFoods = Array.from(this.restaurantFoods.values())
      .reduce((sum, foods) => sum + foods.length, 0);

    return {
      totalRestaurants: this.restaurantIndex?.total_restaurants || 0,
      loadedRestaurants: this.loadedRestaurants.size,
      totalLoadedFoods,
    };
  }
}

// Export singleton instance
export const menuDatabase = MenuDatabaseService.getInstance();

// React Hook for using the menu database
export function useMenuDatabase() {
  const [restaurantList, setRestaurantList] = useState<RestaurantInfo[]>([]);
  const [stats, setStats] = useState(menuDatabase.getStats());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const restaurants = await menuDatabase.loadRestaurantIndex();
      setRestaurantList(restaurants);
      setStats(menuDatabase.getStats());
      setIsLoading(false);
    };

    loadData();
  }, []);

  return {
    isLoading,
    restaurantList,
    stats,
    loadRestaurant: menuDatabase.loadRestaurant.bind(menuDatabase),
    searchFoodsInRestaurant: menuDatabase.searchFoodsInRestaurant.bind(menuDatabase),
    searchFoodsAcrossRestaurants: menuDatabase.searchFoodsAcrossRestaurants.bind(menuDatabase),
    getFoodsByCategory: menuDatabase.getFoodsByCategory.bind(menuDatabase),
    getRestaurantCategories: menuDatabase.getRestaurantCategories.bind(menuDatabase),
    getRestaurantInfo: menuDatabase.getRestaurantInfo.bind(menuDatabase),
    getPopularFoods: menuDatabase.getPopularFoods.bind(menuDatabase),
    getFoodById: menuDatabase.getFoodById.bind(menuDatabase),
  };
}

// Shapes of the menu data built by duke_halal's src/build_nutriuni_menus.py
// (Mobile Order menus with NetNutrition labels linked in).

export interface FoodLabel {
  name: string;
  serving_size: string | null;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturated_fat?: number;
  trans_fat?: number;
  cholesterol?: number;
  added_sugar?: number;
  halal: boolean;
  last_seen: string;
}

// add: adds `food` x quantity; remove: subtracts `food` when it is part of the
// dish; variant: `tags` pick which label the dish uses ("Oat Milk", "Iced");
// none/sub/size: recorded with the order but no nutrition effect.
export type OptionKind = 'add' | 'remove' | 'variant' | 'none' | 'sub' | 'size';

export interface OptionValue {
  name: string;
  kind: OptionKind;
  price?: number;
  default?: boolean;
  food?: string;
  quantity?: number;
  max_quantity?: number;
  tags?: string[];
}

export interface OptionGroup {
  name: string;
  min: number;
  max?: number;
  allow_quantity?: boolean;
  values: OptionValue[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  base?: string;
  base_quantity?: number;
  match?: string;
  halal?: boolean;
  composed?: boolean;
  components?: string[];
  variants?: { food: string; need: string[] }[];
  options?: OptionGroup[];
}

export interface MenuSection {
  name: string;
  items: MenuItem[];
}

export type WeeklyHours = Record<string, [string, string][]>;

export interface RestaurantMenu {
  schema_version: number;
  id: string;
  name: string;
  source: 'mobile_order' | 'netnutrition';
  nutrition_sources: string[];
  nutrition_last_seen: string | null;
  stats: { items: number; with_nutrition: number };
  sections: MenuSection[];
  foods: Record<string, FoodLabel>;
  location_id?: number;
  hours?: WeeklyHours;
  hours_text?: string;
  menu_updated_at?: string;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  file: string;
  hash: string; // content hash of the restaurant file
  icon_hash: string | null;
  source: 'mobile_order' | 'netnutrition';
  icon: string | null;
  items: number;
  with_nutrition: number;
  nutrition_last_seen: string | null;
  hours?: WeeklyHours;
  hours_text?: string;
}

export interface MenuIndex {
  schema_version: number;
  generated_at: string;
  restaurants: RestaurantSummary[];
}

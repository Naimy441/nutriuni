// The user's profile and daily targets. Stored under `user_profile` and
// `nutrition_goals` (formats unchanged from earlier versions).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export type Sex = 'male' | 'female';
export type WeightGoal = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  age: number;
  weight: number; // pounds
  heightFeet: number;
  heightInches: number;
  gender: Sex;
  activityLevel: number; // 1.2 - 1.9
  goal: WeightGoal;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Mostly sitting', detail: 'Classes, desk work, little exercise', icon: 'book-outline' },
  { value: 1.375, label: 'Lightly active', detail: 'Exercise 1–3 days a week', icon: 'walk-outline' },
  { value: 1.55, label: 'Active', detail: 'Exercise 3–5 days a week', icon: 'bicycle-outline' },
  { value: 1.725, label: 'Very active', detail: 'Hard training 6–7 days a week', icon: 'barbell-outline' },
  { value: 1.9, label: 'Athlete', detail: 'Two-a-days or a physical job', icon: 'trophy-outline' },
] as const;

export const WEIGHT_GOALS = [
  { value: 'lose' as const, label: 'Lose weight', detail: 'About 1 lb a week', icon: 'trending-down-outline' },
  { value: 'maintain' as const, label: 'Maintain', detail: 'Stay where I am', icon: 'remove-outline' },
  { value: 'gain' as const, label: 'Build muscle', detail: 'A gradual surplus', icon: 'trending-up-outline' },
] as const;

export const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  fiber: 25,
  sugar: 50,
  sodium: 2300,
};

// Mifflin-St Jeor basal metabolic rate (kcal/day).
export function basalMetabolicRate(profile: UserProfile): number {
  const weightKg = profile.weight * 0.453592;
  const heightCm = (profile.heightFeet * 12 + profile.heightInches) * 2.54;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * profile.age;
  return profile.gender === 'male' ? base + 5 : base - 161;
}

// Targets from the profile. Sources are listed in components/Citations.tsx:
// Mifflin-St Jeor x activity, -500 kcal to lose ~1 lb/week (CDC), +300 to gain;
// protein 1.6 g/kg, fat 28% of calories, carbs the rest (AMDR); fiber
// 14 g/1000 kcal; added sugar per AHA limits; sodium 2,300 mg (DGA).
export function calculateGoals(profile: UserProfile): NutritionGoals {
  let calories = basalMetabolicRate(profile) * profile.activityLevel;
  if (profile.goal === 'lose') calories -= 500;
  if (profile.goal === 'gain') calories += 300;
  calories = Math.max(1200, Math.round(calories / 10) * 10);
  const weightKg = profile.weight * 0.453592;
  const protein = Math.round(weightKg * 1.6);
  const fatCalories = calories * 0.28;
  const fat = Math.round(fatCalories / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fatCalories) / 4));
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: Math.round((calories / 1000) * 14),
    sugar: profile.gender === 'male' ? 36 : 25,
    sodium: 2300,
  };
}

const ONBOARDING_KEY = 'onboarding_complete';

interface GoalsState {
  loaded: boolean;
  onboarded: boolean;
  goals: NutritionGoals;
  profile: UserProfile | null;
}

class GoalsStore {
  private state: GoalsState = { loaded: false, onboarded: false, goals: DEFAULT_GOALS, profile: null };
  private loading: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(next: Partial<GoalsState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach(listener => listener());
  }

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = AsyncStorage.multiGet(['nutrition_goals', 'user_profile', ONBOARDING_KEY])
        .then(([[, goalsText], [, profileText], [, onboardedText]]) => {
          const goals = goalsText ? { ...DEFAULT_GOALS, ...JSON.parse(goalsText) } : DEFAULT_GOALS;
          const profile = profileText ? (JSON.parse(profileText) as UserProfile) : null;
          this.set({ loaded: true, onboarded: onboardedText === 'true', goals, profile });
        })
        .catch(() => this.set({ loaded: true }));
    }
    return this.loading;
  }

  async saveGoals(goals: NutritionGoals) {
    this.set({ goals });
    await AsyncStorage.setItem('nutrition_goals', JSON.stringify(goals));
  }

  // Saves the profile and resets targets to the ones it implies.
  async saveProfile(profile: UserProfile): Promise<NutritionGoals> {
    const goals = calculateGoals(profile);
    this.set({ profile, goals });
    await AsyncStorage.multiSet([
      ['user_profile', JSON.stringify(profile)],
      ['nutrition_goals', JSON.stringify(goals)],
    ]);
    return goals;
  }

  async completeOnboarding(profile: UserProfile): Promise<void> {
    await this.saveProfile(profile);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    this.set({ onboarded: true });
  }

  // Starts with the default targets; details can be added later in Profile.
  async skipOnboarding(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    this.set({ onboarded: true });
  }

  // Forgets the profile and goals and returns to onboarding.
  async reset(): Promise<void> {
    await AsyncStorage.multiRemove(['nutrition_goals', 'user_profile', ONBOARDING_KEY]);
    this.set({ onboarded: false, goals: DEFAULT_GOALS, profile: null });
  }
}

export const goalsStore = new GoalsStore();

export function useGoals() {
  const state = useSyncExternalStore(goalsStore.subscribe, goalsStore.getState);
  useEffect(() => {
    goalsStore.load();
  }, []);
  return state;
}

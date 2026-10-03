// Eating schedules: which meals someone eats, what they're called, when, and
// roughly how big. Meals keep the stored keys (breakfast/lunch/dinner/snack)
// so changing schedule never touches the food log; only labels, timing and
// planning change. Pure functions, shared with scripts/verify-planner.ts.
import { clockLabel, fastingTimes } from './fastingTimes';
import { MealType } from './meals';

export type ScheduleKind = 'standard' | 'no-breakfast' | 'window' | 'omad' | 'ramadan';

export interface EatingWindow {
  start: number; // minutes after midnight
  end: number;
}

export interface EatingSchedule {
  kind: ScheduleKind;
  window: EatingWindow; // used by 'window'
}

export const DEFAULT_SCHEDULE: EatingSchedule = { kind: 'standard', window: { start: 12 * 60, end: 20 * 60 } };

type IconName = 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' | 'cafe-outline' | 'restaurant-outline' | 'star-outline';

export interface MealSlot {
  meal: MealType;
  label: string;
  icon: IconName;
  start: number; // minutes after midnight
  end: number;
  share: number; // typical fraction of the day
  floor: number; // never planned smaller (calories)
  cap: number; // never planned larger (fraction of the day)
  optional?: boolean; // dropped when there isn't room (snacks)
}

export const SCHEDULES: { kind: ScheduleKind; label: string; detail: string; icon: IconName }[] = [
  { kind: 'standard', label: 'Three meals', detail: 'Breakfast, lunch, dinner and snacks', icon: 'restaurant-outline' },
  { kind: 'no-breakfast', label: 'No breakfast', detail: 'Lunch, dinner and snacks', icon: 'partly-sunny-outline' },
  { kind: 'window', label: 'Eating window', detail: 'Intermittent fasting, like 16:8', icon: 'cafe-outline' },
  { kind: 'omad', label: 'One meal a day', detail: 'One bigger meal', icon: 'sunny-outline' },
  { kind: 'ramadan', label: 'Fasting for Ramadan', detail: 'Suhoor before dawn, iftar at sunset', icon: 'moon-outline' },
];

const H = 60;

export function mealSlots(schedule: EatingSchedule, date: string): MealSlot[] {
  switch (schedule.kind) {
    case 'no-breakfast':
      return [
        { meal: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline', start: 11 * H, end: 16 * H, share: 0.45, floor: 400, cap: 0.55 },
        { meal: 'dinner', label: 'Dinner', icon: 'moon-outline', start: 17 * H, end: 22 * H, share: 0.45, floor: 400, cap: 0.55 },
        { meal: 'snack', label: 'Snacks', icon: 'cafe-outline', start: 14 * H, end: 23 * H, share: 0.1, floor: 150, cap: 0.2, optional: true },
      ];
    case 'window': {
      const { start, end } = schedule.window;
      const length = Math.max(2 * H, end - start);
      return [
        { meal: 'lunch', label: 'First meal', icon: 'sunny-outline', start, end: start + Math.min(3 * H, length / 2), share: 0.45, floor: 400, cap: 0.6 },
        { meal: 'dinner', label: 'Last meal', icon: 'moon-outline', start: end - Math.min(3 * H, length / 2), end, share: 0.45, floor: 400, cap: 0.6 },
        { meal: 'snack', label: 'Snacks', icon: 'cafe-outline', start, end, share: 0.1, floor: 150, cap: 0.2, optional: true },
      ];
    }
    case 'omad':
      return [
        { meal: 'dinner', label: 'Meal', icon: 'restaurant-outline', start: 11 * H, end: 22 * H, share: 1, floor: 800, cap: 1 },
      ];
    case 'ramadan': {
      const { fajr, maghrib } = fastingTimes(date);
      return [
        { meal: 'breakfast', label: 'Suhoor', icon: 'star-outline', start: Math.max(0, fajr - 150), end: fajr, share: 0.35, floor: 350, cap: 0.5 },
        { meal: 'dinner', label: 'Iftar', icon: 'moon-outline', start: maghrib, end: Math.min(24 * H, maghrib + 3 * H), share: 0.5, floor: 500, cap: 0.65 },
        { meal: 'snack', label: 'Late snack', icon: 'cafe-outline', start: maghrib + H, end: 24 * H, share: 0.15, floor: 150, cap: 0.25, optional: true },
      ];
    }
    default:
      return [
        { meal: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', start: 7 * H, end: 11 * H + 30, share: 0.25, floor: 250, cap: 0.45 },
        { meal: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline', start: 11 * H, end: 16 * H, share: 0.35, floor: 350, cap: 0.45 },
        { meal: 'dinner', label: 'Dinner', icon: 'moon-outline', start: 17 * H, end: 22 * H, share: 0.3, floor: 400, cap: 0.45 },
        { meal: 'snack', label: 'Snacks', icon: 'cafe-outline', start: 14 * H, end: 23 * H, share: 0.1, floor: 150, cap: 0.2, optional: true },
      ];
  }
}

const STANDARD_LABELS: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
const STANDARD_ICONS: Record<MealType, IconName> = {
  breakfast: 'sunny-outline', lunch: 'partly-sunny-outline', dinner: 'moon-outline', snack: 'cafe-outline',
};

// Label and icon for a stored meal under this schedule (meals outside the
// schedule, like a breakfast logged during Ramadan, keep their usual name).
export function mealInfo(slots: MealSlot[], meal: MealType): { label: string; icon: IconName } {
  const slot = slots.find(s => s.meal === meal);
  return slot ? { label: slot.label, icon: slot.icon } : { label: STANDARD_LABELS[meal], icon: STANDARD_ICONS[meal] };
}

// The meal a new entry most likely belongs to at this time: the one being
// eaten now, else the next one, else the last of the day.
export function mealAt(slots: MealSlot[], minutes: number): MealType {
  const inside = (slot: MealSlot) => minutes >= slot.start && minutes < slot.end;
  const mains = slots.filter(slot => !slot.optional);
  const current = mains.find(inside) ?? slots.find(inside);
  if (current) return current.meal;
  const next = [...mains].sort((a, b) => a.start - b.start).find(slot => slot.start > minutes);
  return (next ?? mains[mains.length - 1] ?? slots[0]).meal;
}

// One line for the Today header: "Suhoor ends 5:48 am · Iftar 6:00 pm".
export function scheduleNote(schedule: EatingSchedule, date: string): string | null {
  if (schedule.kind === 'ramadan') {
    const { fajr, maghrib } = fastingTimes(date);
    return `Suhoor ends ${clockLabel(fajr)} · Iftar ${clockLabel(maghrib)}`;
  }
  if (schedule.kind === 'window') {
    return `Eating window ${clockLabel(schedule.window.start)} – ${clockLabel(schedule.window.end)}`;
  }
  return null;
}

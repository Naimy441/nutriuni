// Local-calendar date helpers. Log days are "YYYY-MM-DD" keys in the user's
// time zone; never parse them with new Date(key), which treats them as UTC and
// shows the previous day in US time zones.

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / 86_400_000);
}

// "Today", "Yesterday", "Tomorrow", else "Mon, Oct 6".
export function relativeDayLabel(key: string, today = dayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function longDayLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function weekdayInitial(key: string): string {
  return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'narrow' });
}

// The seven days (Sunday first) of the week containing `key`.
export function weekOf(key: string): string[] {
  const start = addDays(key, -dateFromKey(key).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

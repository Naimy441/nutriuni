import { menuDatabase, openStatus, OpenStatus, RestaurantSummary, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { useMemo } from 'react';

export interface RestaurantListRow {
  restaurant: RestaurantSummary;
  status: OpenStatus | null;
}

// Every restaurant with its open/closed status: open places first, then the
// rest alphabetically. Updates every minute and when newer menus arrive.
export function useRestaurants(): RestaurantListRow[] {
  const now = useClock();
  const revision = useMenuRevision();
  return useMemo(() => {
    const rows = menuDatabase.listRestaurants().map(restaurant => ({
      restaurant,
      status: restaurant.hours ? openStatus(restaurant.hours, now) : null,
    }));
    return rows.sort((a, b) =>
      Number(Boolean(b.status?.isOpen)) - Number(Boolean(a.status?.isOpen))
      || a.restaurant.name.localeCompare(b.restaurant.name));
    // revision: recomputed when newer menus arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, revision]);
}

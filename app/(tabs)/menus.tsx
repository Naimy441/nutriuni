import { DishRow, RestaurantRow } from '@/components/DiningRows';
import { MenuItemSheet } from '@/components/MenuItemSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { useTabBarSpace } from '@/components/ui/TabBar';
import { radius, space, useTheme } from '@/constants/theme';
import { useQuickAdd } from '@/hooks/useQuickAdd';
import { RestaurantListRow, useRestaurants } from '@/hooks/useRestaurants';
import { menuDatabase, useMenuRevision } from '@/services/MenuDatabase';
import { describePreview } from '@/services/menuNutrition';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import { useRouter } from 'expo-router';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiningScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarSpace();
  const router = useRouter();
  const revision = useMenuRevision();
  const restaurants = useRestaurants();
  const [query, setQuery] = useState('');
  const [pulling, setPulling] = useState(false);
  const [sheet, setSheet] = useState<{ menu: RestaurantMenu; item: MenuItem } | null>(null);
  const search = useDeferredValue(query.trim());
  const { quickAdd, addingId } = useQuickAdd((menu, item) => setSheet({ menu, item }));

  const refresh = async () => {
    setPulling(true);
    await menuDatabase.refresh({ force: true });
    setPulling(false);
  };

  const open = (id: string) => router.push({ pathname: '/restaurant/[name]', params: { name: id } });

  const updated = new Date(menuDatabase.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const openNow = restaurants.filter(row => row.status?.isOpen);
  const others = restaurants.filter(row => !row.status?.isOpen);

  const lower = search.toLowerCase();
  const restaurantMatches = search ? restaurants.filter(row => row.restaurant.name.toLowerCase().includes(lower)) : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dishes = useMemo(() => (search.length >= 2 ? menuDatabase.searchItems(search, 40) : []), [search, revision]);

  const renderRows = (rows: RestaurantListRow[]) =>
    rows.map(row => <RestaurantRow key={row.restaurant.id} {...row} onPress={() => open(row.restaurant.id)} />);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText variant="largeTitle" accessibilityRole="header">Dining</AppText>
        <AppText variant="subhead" tone="secondary">
          {restaurants.length} Duke locations · menus updated {updated}
          {__DEV__ ? ` · ${menuDatabase.source}` : ''}
        </AppText>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search restaurants or dishes" style={styles.search} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={theme.brand} colors={[theme.brand]} />}
      >
        {search ? (
          restaurantMatches.length || dishes.length ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.sections}>
              {restaurantMatches.length > 0 && (
                <View style={styles.section}>
                  <Label>RESTAURANTS</Label>
                  {renderRows(restaurantMatches)}
                </View>
              )}
              {dishes.length > 0 && (
                <View style={styles.section}>
                  <Label>DISHES</Label>
                  <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                    {dishes.map((result, index) => {
                      const menu = menuDatabase.loadRestaurant(result.restaurant.id);
                      if (!menu) return null;
                      return (
                        <DishRow
                          key={`${result.restaurant.id}/${result.item.id}`}
                          item={result.item}
                          subtitle={`${result.restaurant.name} · ${result.section}`}
                          preview={describePreview(menu, result.item)}
                          onPress={() => setSheet({ menu, item: result.item })}
                          onQuickAdd={() => quickAdd(menu, result.item)}
                          adding={addingId === result.item.id}
                          divider={index > 0}
                        />
                      );
                    })}
                  </View>
                </View>
              )}
            </Animated.View>
          ) : (
            <EmptyState icon="search" title="No matches" message={`Nothing matches “${search}”.`} />
          )
        ) : (
          <View style={styles.sections}>
            {openNow.length > 0 && (
              <View style={styles.section}>
                <Label>{`OPEN NOW · ${openNow.length}`}</Label>
                {renderRows(openNow)}
              </View>
            )}
            <View style={styles.section}>
              <Label>{openNow.length ? 'LATER & DINING HALLS' : 'ALL LOCATIONS'}</Label>
              {renderRows(others)}
            </View>
            <AppText variant="caption" tone="tertiary" align="center" style={styles.note}>
              Menus from Duke Mobile Order. Nutrition from Duke NetNutrition labels. Pull down to check for updates.
            </AppText>
          </View>
        )}
      </ScrollView>

      <MenuItemSheet menu={sheet?.menu ?? null} item={sheet?.item ?? null} onClose={() => setSheet(null)} />
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>{children}</AppText>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.lg + space.xs,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: 2,
  },
  search: {
    marginTop: space.md,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  sections: {
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  label: {
    letterSpacing: 0.5,
    paddingHorizontal: space.xs,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
  },
  note: {
    paddingHorizontal: space.xl,
  },
});

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ItemSearchResult, menuDatabase, openStatus, RestaurantSummary, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { describePreview } from '@/services/menuNutrition';
import { EvilIcons, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { CaloriePill } from './CaloriePill';
import { FastAccessSection } from './FastAccessSection';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export function RestaurantExplorer() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const now = useClock();
  const [searchQuery, setSearchQuery] = useState('');
  const [pulling, setPulling] = useState(false);
  const query = useDeferredValue(searchQuery.trim());
  const revision = useMenuRevision();

  const pullToRefresh = async () => {
    setPulling(true);
    await menuDatabase.refresh({ force: true });
    setPulling(false);
  };

  const restaurants = useMemo(() => {
    const rows = menuDatabase.listRestaurants().map(restaurant => ({
      restaurant,
      status: restaurant.hours ? openStatus(restaurant.hours, now) : null,
    }));
    // Open places first, then everything else alphabetically.
    return rows.sort((a, b) =>
      Number(Boolean(b.status?.isOpen)) - Number(Boolean(a.status?.isOpen))
      || a.restaurant.name.localeCompare(b.restaurant.name));
    // Recomputed when newer menus arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, revision]);

  const matchingRestaurants = useMemo(
    () => (query ? restaurants.filter(r => r.restaurant.name.toLowerCase().includes(query.toLowerCase())) : restaurants),
    [restaurants, query],
  );
  const dishResults = useMemo(
    () => (query.length >= 2 ? menuDatabase.searchItems(query, 30) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, revision],
  );

  const openRestaurant = (restaurant: RestaurantSummary) => {
    router.push(`/restaurant/${encodeURIComponent(restaurant.id)}`);
  };
  const openDish = (result: ItemSearchResult) => {
    router.push(`/restaurant/${encodeURIComponent(result.restaurant.id)}?item=${encodeURIComponent(result.item.id)}`);
  };

  const cardBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)';

  const renderRestaurant = ({ restaurant, status }: (typeof restaurants)[number]) => {
    const icon = menuDatabase.icon(restaurant.id);
    const coverage = restaurant.items ? Math.round((restaurant.with_nutrition / restaurant.items) * 100) : 0;
    return (
      <TouchableOpacity
        key={restaurant.id}
        style={[styles.restaurantCard, { backgroundColor: cardBackground }]}
        onPress={() => openRestaurant(restaurant)}
        accessibilityRole="button"
      >
        {icon ? (
          <Image source={icon} style={[styles.icon, styles.iconImage]} contentFit="contain" />
        ) : (
          <View style={[styles.icon, styles.iconFallback]}>
            <Ionicons name={restaurant.source === 'netnutrition' ? 'business' : 'restaurant'} size={20} color="#fff" />
          </View>
        )}
        <View style={styles.restaurantInfo}>
          <ThemedText style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</ThemedText>
          {status?.label ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.isOpen ? '#2F9E44' : '#999' }]} />
              <ThemedText style={styles.statusText}>{status.label}</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.statusText} numberOfLines={1}>
              Dining hall{restaurant.hours_text ? ` · ${restaurant.hours_text}` : ''}
            </ThemedText>
          )}
          <ThemedText style={styles.coverage}>
            {restaurant.with_nutrition
              ? `${restaurant.items} items · nutrition for ${coverage}%`
              : `${restaurant.items} items · no nutrition published`}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
      </TouchableOpacity>
    );
  };

  const renderDish = (result: ItemSearchResult) => {
    const menu = menuDatabase.loadRestaurant(result.restaurant.id);
    const preview = menu ? describePreview(menu, result.item) : { kind: 'none' as const };
    return (
      <TouchableOpacity
        key={`${result.restaurant.id}/${result.item.id}`}
        style={[styles.dishRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
        onPress={() => openDish(result)}
        accessibilityRole="button"
      >
        <View style={styles.dishText}>
          <ThemedText style={styles.dishName} numberOfLines={1}>{result.item.name}</ThemedText>
          <ThemedText style={styles.dishMeta} numberOfLines={1}>{result.restaurant.name} · {result.section}</ThemedText>
        </View>
        <CaloriePill kind={preview.kind} calories={preview.calories} />
      </TouchableOpacity>
    );
  };

  const openCount = restaurants.filter(r => r.status?.isOpen).length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchIconContainer}>
          <EvilIcons name="search" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(60,60,67,0.6)'} />
        </View>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(118,118,128,0.12)',
              color: isDark ? '#FFFFFF' : '#000000',
            },
          ]}
          placeholder="Search restaurants or dishes"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(60,60,67,0.6)'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
            <EvilIcons name="close" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(60,60,67,0.6)'} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pullToRefresh} tintColor={Colors.primary} />}
      >
        {!query && <FastAccessSection />}

        {query ? (
          <>
            {matchingRestaurants.length > 0 && (
              <>
                <ThemedText style={styles.listTitle}>Restaurants</ThemedText>
                {matchingRestaurants.map(renderRestaurant)}
              </>
            )}
            {dishResults.length > 0 && (
              <>
                <ThemedText style={styles.listTitle}>Dishes</ThemedText>
                <View style={[styles.dishList, { backgroundColor: cardBackground }]}>{dishResults.map(renderDish)}</View>
              </>
            )}
            {!matchingRestaurants.length && !dishResults.length && (
              <View style={styles.noResults}>
                <ThemedText style={styles.noResultsText}>{`Nothing matches “${query}”.`}</ThemedText>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.listHeader}>
              <ThemedText style={styles.listTitle}>All Restaurants</ThemedText>
              <ThemedText style={styles.listSubtitle}>{openCount} open now</ThemedText>
            </View>
            {restaurants.map(renderRestaurant)}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    height: 38,
    justifyContent: 'center',
  },
  searchIconContainer: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
  },
  searchInput: {
    height: 38,
    borderRadius: 10,
    paddingLeft: 34,
    paddingRight: 34,
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    paddingHorizontal: 4,
  },
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  iconImage: {
    backgroundColor: '#FFFFFF',
  },
  iconFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  coverage: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.55,
  },
  dishList: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dishText: {
    flex: 1,
  },
  dishName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  dishMeta: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.6,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    opacity: 0.7,
    fontSize: 16,
  },
});

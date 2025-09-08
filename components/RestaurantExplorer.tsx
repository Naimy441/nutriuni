import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { RestaurantInfo, useMenuDatabase } from '@/services/MenuDatabase';
import { EvilIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { FastAccessSection } from './FastAccessSection';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export function RestaurantExplorer() {
  const { isLoading, restaurantList } = useMenuDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter restaurants based on search query
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) {
      return restaurantList;
    }
    return restaurantList.filter(restaurant =>
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [restaurantList, searchQuery]);

  const handleRestaurantPress = (restaurantInfo: RestaurantInfo) => {
    router.push(`/restaurant/${encodeURIComponent(restaurantInfo.name)}`);
  };

  const renderRestaurant = (restaurantInfo: RestaurantInfo) => {
    return (
      <ThemedView key={restaurantInfo.name} style={styles.restaurantCard}>
        <TouchableOpacity
          style={styles.restaurantHeader}
          onPress={() => handleRestaurantPress(restaurantInfo)}
        >
          <View style={styles.restaurantInfo}>
            <ThemedText type="defaultSemiBold" style={styles.restaurantName}>
              {restaurantInfo.name}
            </ThemedText>
            <ThemedText style={styles.restaurantHours}>
              {restaurantInfo.hours}
            </ThemedText>
            <View style={styles.restaurantStats}>
              <ThemedText style={styles.statText}>
                {restaurantInfo.total_items} items
              </ThemedText>
              <ThemedText style={styles.statText}>•</ThemedText>
              <ThemedText style={styles.statText}>
                {restaurantInfo.categories_count} categories
              </ThemedText>
              {restaurantInfo.halal_items > 0 && (
                <>
                  <ThemedText style={styles.statText}>•</ThemedText>
                  <ThemedText style={styles.statText}>
                    {restaurantInfo.halal_items} halal
                  </ThemedText>
                </>
              )}
            </View>
          </View>
          <View style={styles.arrowButton}>
            <ThemedText style={styles.arrowIcon}>›</ThemedText>
          </View>
        </TouchableOpacity>
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading restaurants...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchIconContainer}>
            <EvilIcons 
              name="search" 
              size={20} 
              color={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(60, 60, 67, 0.6)'} 
            />
          </View>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(118, 118, 128, 0.12)',
                color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
              }
            ]}
            placeholder="Search restaurant name..."
            placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(60, 60, 67, 0.6)'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <EvilIcons 
                name="close" 
                size={20} 
                color={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(60, 60, 67, 0.6)'} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fast Access Section - only show when not searching */}
        {!searchQuery.trim() && <FastAccessSection />}
        
        {/* Restaurants Section */}
        {!searchQuery.trim() && (
          <View style={styles.restaurantsHeader}>
            <ThemedText style={styles.restaurantsTitle}>All Restaurants</ThemedText>
          </View>
        )}
        
        {filteredRestaurants.length > 0 ? (
          filteredRestaurants.map(renderRestaurant)
        ) : (
          <View style={styles.noResultsContainer}>
            <ThemedText style={styles.noResultsText}>
              {searchQuery.trim() ? 'No restaurants found matching your search.' : 'No restaurants available.'}
            </ThemedText>
          </View>
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
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding at bottom for full scrolling access
  },
  restaurantCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  restaurantHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    marginBottom: 4,
    color: Colors.primary,
  },
  restaurantHours: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  restaurantStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 12,
    opacity: 0.6,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 104, 56, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    lineHeight: 18,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    opacity: 0.7,
    marginVertical: 20,
  },
  errorText: {
    textAlign: 'center',
    opacity: 0.7,
    marginVertical: 20,
    color: Colors.primary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    position: 'relative',
    height: 36,
  },
  searchInput: {
    height: 36,
    borderRadius: 10,
    paddingLeft: 34,
    paddingRight: 34,
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  searchIconContainer: {
    position: 'absolute',
    left: 10,
    top: 0,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: 0,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: 4,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 16,
  },
  restaurantsHeader: {
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  restaurantsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
});

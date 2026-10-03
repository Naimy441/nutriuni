import { CaloriePill } from '@/components/CaloriePill';
import { MenuItemSheet } from '@/components/MenuItemSheet';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { menuDatabase, openStatus, todaysHours, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { quickLogEntry } from '@/services/menuLogging';
import { canQuickLog, describePreview } from '@/services/menuNutrition';
import type { MenuItem, MenuSection, RestaurantMenu } from '@/services/menuTypes';
import { nutritionTracker, TrackedItem } from '@/services/NutritionTracker';
import { EvilIcons, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, SectionList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ALL = '__all__';

export default function RestaurantPage() {
  const { name, item: itemParam } = useLocalSearchParams<{ name: string; item?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const now = useClock();

  const revision = useMenuRevision();
  const menu = useMemo(
    () => (name ? menuDatabase.loadRestaurant(decodeURIComponent(name)) : null),
    // Newer menus from Firestore replace this restaurant's data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, revision],
  );
  const summary = menu ? menuDatabase.getSummary(menu.id) : undefined;
  const icon = menu ? menuDatabase.icon(menu.id) : undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState(ALL);
  const [onlyWithNutrition, setOnlyWithNutrition] = useState(false);
  // The open sheet keeps the menu it was opened from, even if newer data arrives.
  const [selected, setSelected] = useState<{ menu: RestaurantMenu; item: MenuItem } | null>(null);
  const [toast, setToast] = useState<TrackedItem | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opened from a dish search result: show that dish straight away, once.
  // (Re-running would re-open it later, e.g. from underneath another screen.)
  const openedItemParam = useRef<string | null>(null);
  useEffect(() => {
    if (!menu || !itemParam || openedItemParam.current === itemParam) return;
    openedItemParam.current = itemParam;
    const target = menu.sections.flatMap(s => s.items).find(i => i.id === itemParam);
    if (target) setSelected({ menu, item: target });
  }, [menu, itemParam]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const previews = useMemo(() => {
    const map = new Map<MenuItem, ReturnType<typeof describePreview>>();
    menu?.sections.forEach(section => section.items.forEach(item => map.set(item, describePreview(menu, item))));
    return map;
  }, [menu]);

  const sections = useMemo(() => {
    if (!menu) return [];
    const query = searchQuery.trim().toLowerCase();
    return menu.sections
      .filter(section => activeSection === ALL || section.name === activeSection)
      .map(section => ({
        ...section,
        data: section.items.filter(item => {
          if (onlyWithNutrition && previews.get(item)?.kind === 'none') return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query) || (item.description ?? '').toLowerCase().includes(query);
        }),
      }))
      .filter(section => section.data.length > 0);
  }, [menu, searchQuery, activeSection, onlyWithNutrition, previews]);

  const showToast = (entry: TrackedItem) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(entry);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(hideToast, 4000);
  };

  const hideToast = () => {
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
  };

  const handleUndo = async () => {
    if (!toast) return;
    try {
      await nutritionTracker.removeItem(toast.id);
      hideToast();
    } catch (error) {
      console.error('Error undoing item:', error);
      Alert.alert('Error', 'Failed to undo. Please try removing the item manually.');
    }
  };

  const handleQuickAdd = async (item: MenuItem) => {
    if (!menu) return;
    // Dishes that need a choice (or have no label yet) open the sheet instead.
    if (!canQuickLog(menu, item)) {
      setSelected({ menu, item });
      return;
    }
    setAddingId(item.id);
    try {
      const tracked = await nutritionTracker.addTrackedItem(quickLogEntry(menu, item));
      showToast(tracked);
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item to your daily intake. Please try again.');
    } finally {
      setAddingId(null);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        // Opened from a link there may be no screen to go back to.
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/menus'))}
        style={styles.backButton}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <ThemedText style={styles.backText}>Menus</ThemedText>
      </TouchableOpacity>
    </View>
  );

  if (!menu) {
    return (
      <ThemedView style={styles.container}>
        {header}
        <View style={styles.centered}>
          <ThemedText style={styles.emptyTitle}>Restaurant not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const status = menu.hours ? openStatus(menu.hours, now) : null;
  const hoursLine = menu.hours ? todaysHours(menu.hours, now) : menu.hours_text;
  const coverage = menu.stats.items ? menu.stats.with_nutrition / menu.stats.items : 0;
  const chipBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  const renderItem = ({ item }: { item: MenuItem }) => {
    const preview = previews.get(item) ?? { kind: 'none' as const };
    const adding = addingId === item.id;
    return (
      <View style={[styles.itemRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <TouchableOpacity style={styles.itemMain} onPress={() => setSelected({ menu, item })} accessibilityRole="button">
          <View style={styles.itemTitleRow}>
            <ThemedText style={styles.itemName}>{item.name}</ThemedText>
            {item.halal && (
              <View style={styles.halalBadge}>
                <ThemedText style={styles.halalText}>Halal</ThemedText>
              </View>
            )}
          </View>
          {item.description ? (
            <ThemedText style={styles.itemDescription} numberOfLines={2}>{item.description}</ThemedText>
          ) : null}
          <View style={styles.itemMeta}>
            <CaloriePill kind={preview.kind} calories={preview.calories} />
            {item.price !== undefined && <ThemedText style={styles.price}>${item.price.toFixed(2)}</ThemedText>}
            {item.options?.length ? (
              <ThemedText style={styles.customizable}>Customizable</ThemedText>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, adding && styles.addButtonBusy]}
          onPress={() => handleQuickAdd(item)}
          disabled={adding}
          accessibilityLabel={`Add ${item.name}`}
        >
          <Ionicons name={adding ? 'hourglass' : 'add'} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: MenuSection }) => (
    <ThemedView style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{section.name}</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      {header}
      <View style={styles.hero}>
        {icon ? (
          <Image source={icon} style={[styles.heroIcon, styles.iconImage]} contentFit="contain" />
        ) : (
          <View style={[styles.heroIcon, styles.heroIconFallback]}>
            <Ionicons name="restaurant" size={24} color="#fff" />
          </View>
        )}
        <View style={styles.heroText}>
          <ThemedText style={styles.restaurantTitle} numberOfLines={2}>{menu.name}</ThemedText>
          {status?.label ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.isOpen ? '#2F9E44' : '#999' }]} />
              <ThemedText style={styles.statusText}>{status.label}</ThemedText>
              {hoursLine ? <ThemedText style={styles.hoursText} numberOfLines={1}>· {hoursLine}</ThemedText> : null}
            </View>
          ) : hoursLine ? (
            <ThemedText style={styles.statusText}>{hoursLine}</ThemedText>
          ) : null}
          <ThemedText style={styles.coverageText}>
            {menu.stats.with_nutrition
              ? `Nutrition for ${menu.stats.with_nutrition} of ${menu.stats.items} items (${Math.round(coverage * 100)}%)`
              : 'No nutrition published yet. You can still log meals.'}
          </ThemedText>
        </View>
      </View>

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
          placeholder={`Search ${menu.name}`}
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
        {menu.stats.with_nutrition > 0 && menu.stats.with_nutrition < menu.stats.items && (
          <TouchableOpacity
            style={[styles.chip, { borderColor: chipBorder }, onlyWithNutrition && styles.chipActive]}
            onPress={() => setOnlyWithNutrition(v => !v)}
          >
            <Ionicons name="nutrition-outline" size={14} color={onlyWithNutrition ? '#fff' : Colors.primary} />
            <ThemedText style={[styles.chipText, onlyWithNutrition && styles.chipTextActive]}>Has nutrition</ThemedText>
          </TouchableOpacity>
        )}
        {[{ name: ALL }, ...menu.sections].map(section => {
          const active = activeSection === section.name;
          return (
            <TouchableOpacity
              key={section.name}
              style={[styles.chip, { borderColor: chipBorder }, active && styles.chipActive]}
              onPress={() => setActiveSection(active ? ALL : section.name)}
            >
              <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                {section.name === ALL ? 'All' : section.name}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyTitle}>No dishes match</ThemedText>
            <ThemedText style={styles.emptySubtitle}>Try another search or clear the filters.</ThemedText>
          </View>
        }
        ListFooterComponent={
          summary?.source === 'netnutrition' ? (
            <ThemedText style={styles.footerNote}>
              {"This dining hall isn't on Mobile Order, so its menu lists everything Duke NetNutrition has published for it."}
            </ThemedText>
          ) : menu.nutrition_sources.length ? (
            <ThemedText style={styles.footerNote}>
              Menu from Mobile Order. Nutrition from Duke NetNutrition labels, matched to each dish and option.
            </ThemedText>
          ) : null
        }
      />

      <MenuItemSheet
        menu={selected?.menu ?? null}
        item={selected?.item ?? null}
        onClose={() => setSelected(null)}
        onLogged={showToast}
      />

      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 24 }]}>
          <ThemedText style={styles.toastText} numberOfLines={2}>
            Logged {toast.name}
            {toast.nutrition_status === 'none' ? '' : ` · ${toast.calories.toLocaleString()} cal`}
          </ThemedText>
          <TouchableOpacity onPress={handleUndo} style={styles.toastButton}>
            <ThemedText style={styles.toastButtonText}>UNDO</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    fontSize: 17,
    color: Colors.primary,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  iconImage: {
    backgroundColor: '#FFFFFF',
  },
  heroIconFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  restaurantTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  hoursText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    flexShrink: 1,
  },
  coverageText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
    marginTop: 2,
  },
  searchContainer: {
    marginHorizontal: 16,
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
  chips: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 10,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemMain: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    flexShrink: 1,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
    marginTop: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  price: {
    fontSize: 13,
    opacity: 0.7,
  },
  customizable: {
    fontSize: 12,
    opacity: 0.5,
  },
  halalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  halalText: {
    fontSize: 11,
    lineHeight: 15,
    color: 'white',
    fontWeight: '700',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonBusy: {
    opacity: 0.5,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    opacity: 0.8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.5,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#323232',
    borderRadius: 12,
    paddingLeft: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  toastButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastButtonText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '800',
  },
});

import { DishRow, RestaurantIcon, StatusLine } from '@/components/DiningRows';
import { MenuItemSheet } from '@/components/MenuItemSheet';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SearchField } from '@/components/ui/SearchField';
import { radius, space, useTheme } from '@/constants/theme';
import { useQuickAdd } from '@/hooks/useQuickAdd';
import { hoursTextLabel, menuDatabase, openStatus, todaysHours, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { describePreview } from '@/services/menuNutrition';
import type { MenuItem, MenuSection, RestaurantMenu } from '@/services/menuTypes';
import { checkPreferences, dishDietary, hasPreferences, preferencesLabel } from '@/services/dietary';
import { usePreferences } from '@/services/preferences';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ALL = '__all__';

export default function RestaurantPage() {
  const { name, item: itemParam } = useLocalSearchParams<{ name: string; item?: string }>();
  const router = useRouter();
  const theme = useTheme();
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

  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLowerCase());
  const [activeSection, setActiveSection] = useState(ALL);
  const [onlyWithNutrition, setOnlyWithNutrition] = useState(false);
  const { food } = usePreferences();
  const filtering = hasPreferences(food);
  // Can this kitchen's icons answer the user's preferences at all?
  const missing = menu
    ? [
        (food.diet !== 'none') && !menu.diet_info ? (food.diet === 'vegan' ? 'vegan' : 'vegetarian') : null,
        food.avoid.length > 0 && !menu.allergen_info ? 'allergen' : null,
      ].filter(Boolean) as string[]
    : [];
  const [fitsOnly, setFitsOnly] = useState(true);
  const applyFits = filtering && fitsOnly && missing.length === 0;
  // The open sheet keeps the menu it was opened from, even if newer data arrives.
  const [selected, setSelected] = useState<{ menu: RestaurantMenu; item: MenuItem } | null>(null);
  const { quickAdd, addingId } = useQuickAdd((m, item) => setSelected({ menu: m, item }));

  // Opened from a dish search result: show that dish straight away, once.
  const openedItemParam = useRef<string | null>(null);
  useEffect(() => {
    if (!menu || !itemParam || openedItemParam.current === itemParam) return;
    openedItemParam.current = itemParam;
    const target = menu.sections.flatMap(s => s.items).find(i => i.id === itemParam);
    if (target) setSelected({ menu, item: target });
  }, [menu, itemParam]);

  const fits = useMemo(() => {
    const map = new Map<MenuItem, boolean>();
    if (menu && filtering) {
      menu.sections.forEach(section => section.items.forEach(item => map.set(item, checkPreferences(dishDietary(menu, item), food).fits)));
    }
    return map;
  }, [menu, filtering, food]);

  const previews = useMemo(() => {
    const map = new Map<MenuItem, ReturnType<typeof describePreview>>();
    menu?.sections.forEach(section => section.items.forEach(item => map.set(item, describePreview(menu, item))));
    return map;
  }, [menu]);

  const sections = useMemo(() => {
    if (!menu) return [];
    return menu.sections
      .filter(section => activeSection === ALL || section.name === activeSection)
      .map(section => ({
        ...section,
        data: section.items.filter(item => {
          if (onlyWithNutrition && previews.get(item)?.kind === 'none') return false;
          if (applyFits && !fits.get(item)) return false;
          if (!search) return true;
          return item.name.toLowerCase().includes(search) || (item.description ?? '').toLowerCase().includes(search);
        }),
      }))
      .filter(section => section.data.length > 0);
  }, [menu, search, activeSection, onlyWithNutrition, previews, applyFits, fits]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus'));

  if (!menu) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={back} />
        </View>
        <EmptyState icon="alert-circle-outline" title="Restaurant not found" message="It may have closed or changed its name." actionLabel="Back to Dining" onAction={back} />
      </View>
    );
  }

  const status = menu.hours ? openStatus(menu.hours, now) : null;
  const hoursLine = menu.hours ? todaysHours(menu.hours, now) : hoursTextLabel(menu.hours_text);

  const renderItem = ({ item, index, section }: { item: MenuItem; index: number; section: { data: MenuItem[] } }) => (
    <View
      style={[
        styles.rowWrap,
        { backgroundColor: theme.surface, borderColor: theme.separator },
        index === 0 && styles.rowFirst,
        index === section.data.length - 1 && styles.rowLast,
      ]}
    >
      <DishRow
        item={item}
        menu={menu}
        dietFiltered={applyFits}
        preview={previews.get(item) ?? { kind: 'none' }}
        onPress={() => setSelected({ menu, item })}
        onQuickAdd={() => quickAdd(menu, item)}
        adding={addingId === item.id}
        divider={index > 0}
      />
    </View>
  );

  const renderSectionHeader = ({ section }: { section: MenuSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <AppText variant="footnote" tone="secondary" weight="600" style={styles.sectionTitle}>{section.name.toUpperCase()}</AppText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.xs, borderBottomColor: theme.separator }]}>
        <View style={styles.hero}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={back} />
          {summary ? <RestaurantIcon restaurant={summary} size={44} /> : null}
          <View style={styles.flex}>
            <AppText variant="title3" numberOfLines={1} accessibilityRole="header">{menu.name}</AppText>
            <StatusLine status={status} fallback={hoursLine} detail={status?.label ? hoursLine : undefined} />
            {menu.stats.with_nutrition === 0 && (
              <AppText variant="caption" tone="tertiary">No nutrition info · you can enter your own</AppText>
            )}
            {filtering && missing.length > 0 && (
              <AppText variant="caption" tone="warning" numberOfLines={2}>
                No {missing.join(' or ')} info here. Ask staff.
              </AppText>
            )}
          </View>
        </View>
        <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${menu.name}`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filtering && missing.length === 0 && (
            <Chip label={preferencesLabel(food)} icon="leaf-outline" selected={fitsOnly} onPress={() => setFitsOnly(v => !v)} />
          )}
          {menu.stats.with_nutrition > 0 && menu.stats.with_nutrition < menu.stats.items && (
            <Chip label="With nutrition" icon="nutrition-outline" selected={onlyWithNutrition} onPress={() => setOnlyWithNutrition(v => !v)} />
          )}
          {[{ name: ALL }, ...menu.sections].map(section => (
            <Chip
              key={section.name}
              label={section.name === ALL ? 'All' : section.name}
              selected={activeSection === section.name}
              onPress={() => setActiveSection(activeSection === section.name ? ALL : section.name)}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.huge }]}
        ListEmptyComponent={
          applyFits && !search
            ? <EmptyState icon="leaf-outline" title="Nothing marked for you here" message={`No dishes here are marked ${preferencesLabel(food).toLowerCase()}. Turn off the filter to see everything.`} compact />
            : <EmptyState icon="search" title="No dishes match" message="Try another search or clear the filters." compact />
        }
        ListFooterComponent={
          summary?.source === 'netnutrition' ? (
            <AppText variant="caption" tone="tertiary" align="center" style={styles.footerNote}>
              Not every dish here is served every day.
            </AppText>
          ) : null
        }
      />

      <MenuItemSheet menu={selected?.menu ?? null} item={selected?.item ?? null} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  top: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: space.xs,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  chips: {
    gap: space.sm,
  },
  list: {
    paddingHorizontal: space.lg,
  },
  sectionHeader: {
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  sectionTitle: {
    letterSpacing: 0.5,
    paddingHorizontal: space.xs,
  },
  rowWrap: {
    paddingHorizontal: space.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  rowFirst: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footerNote: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
});

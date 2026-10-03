// The Log sheet (centre "+" and each meal's "+"): search every dining menu,
// re-log recent foods and saved meals, browse a restaurant, or add calories.
import { DishRow, RestaurantRow, StatusLine } from '@/components/DiningRows';
import { MenuItemSheet } from '@/components/MenuItemSheet';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SearchField } from '@/components/ui/SearchField';
import { Segmented } from '@/components/ui/Segmented';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { useQuickAdd } from '@/hooks/useQuickAdd';
import { useRestaurants } from '@/hooks/useRestaurants';
import { relativeDayLabel } from '@/services/dates';
import { CUSTOM_MEAL_RESTAURANT, FastAccessItem, fastAccessService, useFastAccess } from '@/services/FastAccessService';
import { isMealType, MEALS, MealType, mealForTime, mealLabel } from '@/services/meals';
import { menuDatabase, openStatus, useClock, useMenuRevision } from '@/services/MenuDatabase';
import { describePreview } from '@/services/menuNutrition';
import type { MenuItem, RestaurantMenu } from '@/services/menuTypes';
import { formatTrackedCalories, mealOf, nutritionTracker, useDayLog, useToday } from '@/services/NutritionTracker';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'recent' | 'meals' | 'dining' | 'quick';

const TABS: { value: Tab; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'meals', label: 'My meals' },
  { value: 'dining', label: 'Dining' },
  { value: 'quick', label: 'Quick add' },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FOOTER_HEIGHT = 72;

export default function LogScreen() {
  // This screen is a native modal, which draws above the root providers, so
  // it brings its own sheet host and toasts.
  return (
    <BottomSheetModalProvider>
      <ToastProvider bottomOffset={FOOTER_HEIGHT + space.md}>
        <LogContent />
      </ToastProvider>
    </BottomSheetModalProvider>
  );
}

function LogContent() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = typeof params.date === 'string' && DATE_PATTERN.test(params.date) && params.date <= today ? params.date : today;
  const [meal, setMeal] = useState<MealType>(isMealType(params.meal) ? params.meal : mealForTime());
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ menu: RestaurantMenu; item: MenuItem } | null>(null);
  const search = useDeferredValue(query.trim());
  const searching = search.length >= 2;
  const scrollRef = useRef<ScrollView>(null);

  // Each list starts at the top, not where the previous one was scrolled.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab, browsing, searching]);

  const { recents, customMeals, all } = useFastAccess();
  const openSheet = (menu: RestaurantMenu, item: MenuItem) => setSheet({ menu, item });
  const { quickAdd, addingId } = useQuickAdd(openSheet, { date, meal });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const logSaved = async (item: FastAccessItem) => {
    const added = await nutritionTracker.addTrackedItem(fastAccessService.toNewTrackedItem(item), { date, meal });
    toast.show({
      message: `Added ${item.name} to ${mealLabel(meal)}`,
      action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(added.id, date) },
    });
  };

  const forget = (item: FastAccessItem) => {
    Alert.alert(
      item.type === 'custom' ? 'Delete this meal?' : 'Remove from recents?',
      item.name,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: item.type === 'custom' ? 'Delete' : 'Remove',
          style: 'destructive',
          onPress: () => fastAccessService.removeFastAccessItem(item.id),
        },
      ],
    );
  };

  const isIOS = Platform.OS === 'ios';
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={isIOS ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: isIOS ? space.lg : insets.top + space.md }]}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="title1" accessibilityRole="header">Log food</AppText>
            <AppText variant="subhead" tone="secondary">
              {mealLabel(meal)} · {relativeDayLabel(date, today)}
            </AppText>
          </View>
          <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealChips}>
          {MEALS.map(option => (
            <Chip key={option.key} label={option.label} icon={option.icon} selected={meal === option.key} onPress={() => setMeal(option.key)} />
          ))}
        </ScrollView>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search dishes, restaurants, your meals" />
        {!searching && <Segmented options={TABS} value={tab} onChange={next => { setTab(next); setBrowsing(null); }} />}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: FOOTER_HEIGHT + insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {searching ? (
          <SearchResults
            query={search}
            saved={all}
            onLogSaved={logSaved}
            onOpenRestaurant={id => {
              setQuery('');
              setTab('dining');
              setBrowsing(id);
            }}
            onOpenDish={openSheet}
            onQuickAdd={quickAdd}
            addingId={addingId}
          />
        ) : tab === 'recent' ? (
          <SavedList
            items={recents}
            onLog={logSaved}
            onLongPress={forget}
            empty={
              <EmptyState
                icon="time-outline"
                title="No recent foods yet"
                message="Everything you log shows up here so you can add it again with one tap."
                actionLabel="Browse dining"
                onAction={() => setTab('dining')}
              />
            }
          />
        ) : tab === 'meals' ? (
          <SavedList
            items={customMeals}
            onLog={logSaved}
            onLongPress={forget}
            footer={<Button title="Create a meal" icon="add" variant="tinted" size="md" onPress={() => setTab('quick')} />}
            empty={
              <EmptyState
                icon="bookmark-outline"
                title="Save meals you eat often"
                message="Use Quick add and turn on “Save to My meals” for anything you eat regularly."
                actionLabel="Create a meal"
                onAction={() => setTab('quick')}
              />
            }
          />
        ) : tab === 'dining' ? (
          browsing ? (
            <RestaurantMenuList
              id={browsing}
              onBack={() => setBrowsing(null)}
              onOpenDish={openSheet}
              onQuickAdd={quickAdd}
              addingId={addingId}
            />
          ) : (
            <RestaurantList onOpen={setBrowsing} />
          )
        ) : (
          <QuickAddForm date={date} meal={meal} />
        )}
      </ScrollView>

      <MealFooter date={date} meal={meal} onDone={close} />

      <MenuItemSheet
        menu={sheet?.menu ?? null}
        item={sheet?.item ?? null}
        onClose={() => setSheet(null)}
        date={date}
        meal={meal}
      />
    </KeyboardAvoidingView>
  );
}

// ---- footer: what's in this meal so far ----

function MealFooter({ date, meal, onDone }: { date: string; meal: MealType; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { log } = useDayLog(date);
  const items = log.items.filter(item => mealOf(item) === meal);
  const calories = items.reduce((sum, item) => sum + (item.nutrition_status === 'none' ? 0 : item.calories), 0);
  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: theme.surface, borderTopColor: theme.separator },
      ]}
    >
      <View style={styles.flex}>
        <AppText variant="caption" tone="secondary">{mealLabel(meal)} so far</AppText>
        <AppText variant="headline" numeric>
          {items.length ? `${formatNumber(calories)} cal · ${items.length} item${items.length === 1 ? '' : 's'}` : 'Nothing yet'}
        </AppText>
      </View>
      <Button title="Done" size="md" onPress={onDone} style={styles.doneButton} />
    </View>
  );
}

// ---- recents & saved meals ----

function SavedRow({ item, onLog, onLongPress, divider }: {
  item: FastAccessItem;
  onLog: (item: FastAccessItem) => void;
  onLongPress: (item: FastAccessItem) => void;
  divider: boolean;
}) {
  const theme = useTheme();
  const subtitle = [item.type === 'custom' ? 'My meal' : item.restaurant, item.details || item.serving_size].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => onLog(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => [
        styles.savedRow,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
        pressed && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name}, ${formatTrackedCalories(item)}`}
      accessibilityHint="Long press to remove"
    >
      <View style={styles.flex}>
        <AppText variant="callout" weight="600" numberOfLines={1}>{item.name}</AppText>
        <AppText variant="footnote" tone="tertiary" numberOfLines={1}>{subtitle}</AppText>
      </View>
      <AppText variant="subhead" weight="600" numeric tone="secondary">{formatTrackedCalories(item)}</AppText>
      <View style={[styles.addCircle, { backgroundColor: theme.brandSoft }]}>
        <Ionicons name="add" size={20} color={theme.brandText} />
      </View>
    </Pressable>
  );
}

function SavedList({ items, onLog, onLongPress, empty, footer }: {
  items: FastAccessItem[];
  onLog: (item: FastAccessItem) => void;
  onLongPress: (item: FastAccessItem) => void;
  empty: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  if (!items.length) return <>{empty}</>;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        {items.map((item, index) => (
          <SavedRow key={item.id} item={item} onLog={onLog} onLongPress={onLongPress} divider={index > 0} />
        ))}
      </View>
      <AppText variant="caption" tone="tertiary" align="center">Tap to add · Long press to remove</AppText>
      {footer}
    </Animated.View>
  );
}

// ---- search ----

function SearchResults({ query, saved, onLogSaved, onOpenRestaurant, onOpenDish, onQuickAdd, addingId }: {
  query: string;
  saved: FastAccessItem[];
  onLogSaved: (item: FastAccessItem) => void;
  onOpenRestaurant: (id: string) => void;
  onOpenDish: (menu: RestaurantMenu, item: MenuItem) => void;
  onQuickAdd: (menu: RestaurantMenu, item: MenuItem) => void;
  addingId: string | null;
}) {
  const theme = useTheme();
  const revision = useMenuRevision();
  const restaurants = useRestaurants();
  const lower = query.toLowerCase();
  const savedMatches = saved.filter(item => item.name.toLowerCase().includes(lower)).slice(0, 5);
  const restaurantMatches = restaurants.filter(row => row.restaurant.name.toLowerCase().includes(lower)).slice(0, 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dishes = useMemo(() => menuDatabase.searchItems(query, 40), [query, revision]);

  if (!savedMatches.length && !restaurantMatches.length && !dishes.length) {
    return <EmptyState icon="search" title="No matches" message={`Nothing matches “${query}”. Try Quick add to enter calories yourself.`} />;
  }
  return (
    <View style={styles.gap}>
      {savedMatches.length > 0 && (
        <View style={styles.smallGap}>
          <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>YOUR FOODS</AppText>
          <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {savedMatches.map((item, index) => (
              <SavedRow key={item.id} item={item} onLog={onLogSaved} onLongPress={() => {}} divider={index > 0} />
            ))}
          </View>
        </View>
      )}
      {restaurantMatches.length > 0 && (
        <View style={styles.smallGap}>
          <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>RESTAURANTS</AppText>
          {restaurantMatches.map(row => (
            <RestaurantRow key={row.restaurant.id} restaurant={row.restaurant} status={row.status} onPress={() => onOpenRestaurant(row.restaurant.id)} />
          ))}
        </View>
      )}
      {dishes.length > 0 && (
        <View style={styles.smallGap}>
          <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>DISHES</AppText>
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
                  onPress={() => onOpenDish(menu, result.item)}
                  onQuickAdd={() => onQuickAdd(menu, result.item)}
                  adding={addingId === result.item.id}
                  divider={index > 0}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ---- dining ----

function RestaurantList({ onOpen }: { onOpen: (id: string) => void }) {
  const restaurants = useRestaurants();
  const open = restaurants.filter(row => row.status?.isOpen);
  const rest = restaurants.filter(row => !row.status?.isOpen);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
      {open.length > 0 && (
        <View style={styles.smallGap}>
          <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>OPEN NOW</AppText>
          {open.map(row => <RestaurantRow key={row.restaurant.id} {...row} onPress={() => onOpen(row.restaurant.id)} />)}
        </View>
      )}
      <View style={styles.smallGap}>
        <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>{open.length ? 'EVERYTHING ELSE' : 'ALL RESTAURANTS'}</AppText>
        {rest.map(row => <RestaurantRow key={row.restaurant.id} {...row} onPress={() => onOpen(row.restaurant.id)} />)}
      </View>
    </Animated.View>
  );
}

function RestaurantMenuList({ id, onBack, onOpenDish, onQuickAdd, addingId }: {
  id: string;
  onBack: () => void;
  onOpenDish: (menu: RestaurantMenu, item: MenuItem) => void;
  onQuickAdd: (menu: RestaurantMenu, item: MenuItem) => void;
  addingId: string | null;
}) {
  const theme = useTheme();
  const now = useClock();
  const revision = useMenuRevision();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const menu = useMemo(() => menuDatabase.loadRestaurant(id), [id, revision]);
  const previews = useMemo(() => {
    const map = new Map<MenuItem, ReturnType<typeof describePreview>>();
    menu?.sections.forEach(section => section.items.forEach(item => map.set(item, describePreview(menu, item))));
    return map;
  }, [menu]);
  if (!menu) {
    return <EmptyState icon="alert-circle-outline" title="Menu unavailable" actionLabel="Back" onAction={onBack} />;
  }
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
      <PressableScale onPress={onBack} style={styles.backRow} accessibilityLabel="Back to restaurants">
        <Ionicons name="chevron-back" size={20} color={theme.brandText} />
        <AppText variant="subhead" weight="600" tone="brand">All restaurants</AppText>
      </PressableScale>
      <View>
        <AppText variant="title2">{menu.name}</AppText>
        <StatusLine status={menu.hours ? openStatus(menu.hours, now) : null} fallback={menu.hours_text} />
      </View>
      {menu.sections.map(section => (
        <View key={section.name} style={styles.smallGap}>
          <AppText variant="footnote" tone="secondary" weight="600" style={styles.label}>{section.name.toUpperCase()}</AppText>
          <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {section.items.map((item, index) => (
              <DishRow
                key={item.id}
                item={item}
                preview={previews.get(item) ?? { kind: 'none' }}
                onPress={() => onOpenDish(menu, item)}
                onQuickAdd={() => onQuickAdd(menu, item)}
                adding={addingId === item.id}
                divider={index > 0}
              />
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

// ---- quick add ----

const MACRO_FIELDS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
] as const;

function QuickAddForm({ date, meal }: { date: string; meal: MealType }) {
  const theme = useTheme();
  const toast = useToast();
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [macros, setMacros] = useState({ protein: '', carbs: '', fat: '' });
  const [save, setSave] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const calorieValue = parseFloat(calories);
  const calorieError = !Number.isFinite(calorieValue) || calorieValue <= 0
    ? 'Enter calories'
    : calorieValue > 10000 ? 'That looks too high' : null;
  const nameError = save && !name.trim() ? 'Name your meal to save it' : null;
  const valid = !calorieError && !nameError;

  const submit = async () => {
    setSubmitted(true);
    if (!valid || busy) return;
    setBusy(true);
    const read = (text: string) => Math.max(0, Math.round((parseFloat(text) || 0) * 10) / 10);
    const entry = {
      name: name.trim() || 'Quick add',
      restaurant: save ? CUSTOM_MEAL_RESTAURANT : 'Quick add',
      calories: Math.round(calorieValue),
      protein: read(macros.protein),
      carbs: read(macros.carbs),
      fat: read(macros.fat),
      fiber: 0,
      sugar: 0,
      sodium: 0,
      serving_size: '1 serving',
      nutrition_status: 'manual' as const,
    };
    try {
      const added = await nutritionTracker.addTrackedItem(entry, { date, meal, remember: save });
      toast.show({
        message: `Added ${entry.name} · ${entry.calories.toLocaleString()} cal`,
        action: { label: 'Undo', onPress: () => nutritionTracker.removeItem(added.id, date) },
      });
      setName('');
      setCalories('');
      setMacros({ protein: '', carbs: '', fat: '' });
      setSubmitted(false);
    } catch {
      toast.show({ message: "Couldn't save that. Please try again.", tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }];
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
      <View style={styles.field}>
        <AppText variant="footnote" tone="secondary" weight="600">Name {save ? '' : '(optional)'}</AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Protein shake"
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.brand}
          style={inputStyle}
          returnKeyType="next"
          maxLength={60}
          accessibilityLabel="Name"
        />
        {submitted && nameError ? <AppText variant="footnote" tone="danger">{nameError}</AppText> : null}
      </View>

      <View style={styles.field}>
        <AppText variant="footnote" tone="secondary" weight="600">Calories</AppText>
        <View style={[styles.caloriesInput, { backgroundColor: theme.surface, borderColor: submitted && calorieError ? theme.danger : theme.separator }]}>
          <TextInput
            value={calories}
            onChangeText={text => setCalories(text.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={theme.textTertiary}
            selectionColor={theme.brand}
            keyboardType="decimal-pad"
            style={[styles.caloriesText, { color: theme.text }]}
            accessibilityLabel="Calories"
          />
          <AppText variant="headline" tone="tertiary">cal</AppText>
        </View>
        {submitted && calorieError ? <AppText variant="footnote" tone="danger">{calorieError}</AppText> : null}
      </View>

      <View style={styles.macroRow}>
        {MACRO_FIELDS.map(field => (
          <View key={field.key} style={[styles.field, styles.flex]}>
            <View style={styles.macroLabel}>
              <View style={[styles.dot, { backgroundColor: theme[field.key] }]} />
              <AppText variant="footnote" tone="secondary" weight="600">{field.label}</AppText>
            </View>
            <View style={[styles.unitInput, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <TextInput
                value={macros[field.key]}
                onChangeText={text => setMacros(prev => ({ ...prev, [field.key]: text.replace(/[^0-9.]/g, '') }))}
                placeholder="0"
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.brand}
                keyboardType="decimal-pad"
                style={[styles.unitText, { color: theme.text }]}
                accessibilityLabel={`${field.label} in grams`}
              />
              <AppText variant="footnote" tone="tertiary">g</AppText>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => setSave(v => !v)}
        style={[styles.saveRow, { backgroundColor: theme.surface, borderColor: theme.separator }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: save }}
      >
        <Ionicons name="bookmark-outline" size={20} color={theme.brandText} />
        <View style={styles.flex}>
          <AppText variant="callout" weight="600">Save to My meals</AppText>
          <AppText variant="footnote" tone="tertiary">Add it again later with one tap</AppText>
        </View>
        <Switch value={save} onValueChange={setSave} trackColor={{ true: theme.brand, false: theme.fillStrong }} />
      </Pressable>

      <Button
        title={valid ? `Add to ${mealLabel(meal)} · ${Math.round(calorieValue).toLocaleString()} cal` : `Add to ${mealLabel(meal)}`}
        icon="add-circle"
        onPress={submit}
        loading={busy}
        haptic="medium"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  mealChips: {
    gap: space.sm,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  gap: {
    gap: space.lg,
  },
  smallGap: {
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    minWidth: 96,
  },
  field: {
    gap: space.xs,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  caloriesInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    height: 64,
  },
  caloriesText: {
    flex: 1,
    minWidth: 0,
    fontSize: 30,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  macroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  unitInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    height: 48,
  },
  unitText: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

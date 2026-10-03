# Nutriuni production redesign — plan & status

Paused mid-way (usage limit). **The app does not currently compile**: the data
services were rewritten with new APIs and these old callers still use the old ones:

- `app/(tabs)/index.tsx` (uses `useNutritionTracker`, `addCustomMeal`, old modals)
- `services/FoodHistoryService.ts` (uses removed `getMostRecentLogs`, `formatDateForDisplay`, …)
- `components/FastAccessSection.tsx` (uses `fastAccessItemToTrackedItem`, old hook shape)
- `components/MenuItemSheet.tsx` (uses `useNutritionTracker().addItem`)

Check with `npx tsc --noEmit -p .`. Fastest way back to green: finish step 3 below
(those files are all being replaced/deleted anyway).

## Done so far

### Backend / data (complete, deployed, verified)
- duke_halal builds Mobile Order + NetNutrition menus → `outputs/nutriuni/` (3×/day CI).
- Cloud Function `syncMenus` (functions/) polls GitHub every 15 min → Firestore.
- App `services/MenuDatabase.ts`: bundled → AsyncStorage cache → Firestore.
- Checks: `node scripts/check-firestore-menus.mjs`, `npm --prefix functions test`,
  `npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-menu-data.js`.

### Redesign foundation (written, not yet wired into screens)
- `constants/theme.ts` — light/dark tokens (`useTheme()`), nutrient colors, spacing,
  radius, type scale, `shadow()`, `tabularNums`. Brand green `#0E7C4A` (dark `#2FBF71`).
- `services/dates.ts` — local `dayKey`, `dateFromKey`, `addDays`, `relativeDayLabel`,
  `weekOf`… **Fixes a real bug**: old code parsed `YYYY-MM-DD` with `new Date(key)`
  (UTC) so Today/Yesterday labels were wrong in US time zones.
- `services/meals.ts` — Breakfast/Lunch/Dinner/Snacks + `mealForTime()`.
- `services/NutritionTracker.ts` — **rewritten** as one shared store (same storage
  keys `nutrition_log_YYYY-MM-DD`, so existing user history is kept). API:
  `nutritionTracker.addTrackedItem(entry, {date?, meal?})`, `removeItem(id, date)`,
  `restoreItem(item, date)` (undo), `updateItem(id, date, patch)`, `clearDay`,
  `listLoggedDays`. Hooks: `useDayLog(date)`, `useDayLogs(dates)`, `useLoggedDays()`,
  `useToday()` (rolls over at midnight). Items now have `meal` and `sodium`.
- `services/FastAccessService.ts` — rewritten store (same key `fast_access_items`):
  `useFastAccess()` → `{recents, customMeals, all}`, `toNewTrackedItem(item)`,
  `removeFastAccessItem(id)`. Custom meals are never evicted.
- `services/goals.ts` — profile + goals store (same keys `user_profile`,
  `nutrition_goals`), `calculateGoals(profile)` (Mifflin-St Jeor etc., moved out of
  onboarding), `ACTIVITY_LEVELS`, `WEIGHT_GOALS`, `useGoals()`, `goalsStore.saveGoals`,
  `goalsStore.saveProfile` (recalculates targets). Adds sodium goal (2,300 mg).
- `components/ui/` kit: `AppText` (variants/tones), `PressableScale` (press-scale +
  haptics), `Button`, `Card`, `IconButton`, `Chip`, `ProgressRing` (animated SVG),
  `ProgressBar` (animated), `AnimatedNumber`, `Toast` (`ToastProvider`/`useToast`,
  with Undo action), `SearchField`, `Stepper`, `Segmented` (sliding thumb),
  `SectionHeader`, `EmptyState`, `Sheet` (styled BottomSheetModal).

## Research takeaways (MacroFactor, MyFitnessPal, Cronometer, Lose It!, Yazio)
- Retention is won by **low-friction logging**: several routes (recents, search,
  quick add), one-tap re-log, corrections as a normal step.
- Dashboard: one clear **"calories left"** number (goal − eaten), macro progress,
  meals grouped by time of day.
- Onboarding: **goal first**, ask only what the plan needs, end with a **plan reveal**,
  everything editable later.
- Progress/streaks: calm, non-judgmental; never imply logging = health outcome.
- Marketing/ASO: first 3 screenshots carry the conversion; benefit-led captions
  ("Every Duke dining menu, with nutrition", "Build your order, see calories live",
  "Hit your goals — one tap to log"), real UI not stock photos, bright high contrast.
  Keywords: calorie counter, macro tracker, Duke dining, college meal tracker.
  Sources: screensdesign.com/articles/calorie-tracker-app-design,
  welling.ai/articles/which-features-in-calorie-tracking-apps-actually-matter,
  apptweak.com/en/aso-blog/how-to-optimize-your-app-screenshots.

## Remaining work (in order)

1. **Root shell** `app/_layout.tsx`: `SplashScreen.preventAutoHideAsync()` until
   onboarding flag + `goalsStore.load()` resolve; drop SpaceMono `useFonts`; providers
   (GestureHandlerRootView, nav ThemeProvider built from `useTheme()`,
   BottomSheetModalProvider, ToastProvider); keep `menuDatabase.start()`.
   Stack: `(tabs)`, `restaurant/[name]`, `day/[date]`, `log` (presentation modal),
   `goals`, `profile-edit`, `sources`.
   ⚠️ Native modals render above the root: wrap modal screens (log, goals…) in their
   own `BottomSheetModalProvider` + `ToastProvider`.
2. **Custom tab bar** (`components/ui/TabBar.tsx`, blur via expo-blur): Today, Dining
   (`menus` route), centre **+ Log** button → `/log`, Progress, Profile.
   Screens need ~100pt bottom padding.
3. **Today** (`app/(tabs)/index.tsx` → shared `components/DayView.tsx`, also used by
   `app/day/[date].tsx`): greeting + week strip (`weekOf`, dots on logged days);
   hero card with `ProgressRing` = calories left (AnimatedNumber), eaten/goal;
   P/C/F `ProgressBar`s + fiber/sugar/sodium chips (tap → nutrient breakdown sheet);
   meal sections (Breakfast/Lunch/Dinner/Snacks via `mealOf`) each with "+" →
   `/log?date=&meal=`; swipe/tap item → TrackedItem sheet (details, move meal, log
   again, delete with Undo toast); recents row for one-tap re-log; empty state →
   Dining. Then **delete** FoodHistoryService, FoodHistorySection, AllFoodHistoryModal,
   NutritionBreakdownModal, NutritionCard, CircularProgress, EditGoalsModal,
   AddCustomMealModal, FastAccessSection, TrackedItemModal, ParallaxScrollView,
   HelloWave, Collapsible, ExternalLink, ThemedText/ThemedView (after migrating).
4. **Log** (`app/log.tsx`, params `date`, `meal`): SearchField over
   `menuDatabase.searchItems` (open `MenuItemSheet` directly, not via restaurant),
   tabs Recent / My meals / Quick add (name optional, calories required, macros
   optional, "save as my meal"). Log via `nutritionTracker.addTrackedItem(entry,
   {date, meal})`, toast with Undo (`removeItem`).
5. **MenuItemSheet**: switch to `nutritionTracker.addTrackedItem` + accept
   `date`/`meal` props; restyle with `Sheet` + ui kit (logic in menuNutrition stays).
6. **Dining** (`menus.tsx`, `RestaurantExplorer`, `restaurant/[name].tsx`):
   restyle with theme/ui kit; "Open now" section, skeleton-free (data is sync).
7. **Progress** (`app/(tabs)/progress.tsx`): Segmented week/month; SVG bar chart of
   calories vs goal line; averages (cal, protein); days logged + streak (calm copy);
   list of logged days → `/day/[date]`.
8. **Profile** (`app/(tabs)/profile.tsx`): plan summary card; Edit goals (`goals`
   screen, manual targets + "recalculate from profile"); Edit profile
   (`profile-edit`, reuses onboarding inputs, `saveProfile`); Sources & methodology
   (`sources`, from `components/Citations.tsx` — keep, App Store guideline 1.4.1);
   Send feedback (existing Google Form URL in old index.tsx); data last updated
   (`menuDatabase.generatedAt`); Reset data (confirm).
9. **Onboarding** (`components/OnboardingScreen.tsx` rewrite): welcome with 3 value
   props → goal → sex → age/height/weight (steppers or large numeric inputs, back
   button, inline validation not Alerts) → activity cards → **plan reveal**
   (animated ring + macro split) → Start. Save via `goalsStore.saveProfile`, set
   `onboarding_complete`.
10. **QA**: `npx tsc --noEmit -p .`, `npx eslint app components services`, menu
    verifier, then native build (`LANG=en_US.UTF-8 npx expo run:ios --device <id>`;
    Expo Go on the simulator is SDK 54 and can't run this SDK 53 app). Test light +
    dark mode, Dynamic Type, VoiceOver labels, offline, midnight rollover, undo,
    logging to past days, fresh install onboarding.
11. Remove the dev-only `· source` tag in `app/(tabs)/menus.tsx` if unwanted;
    produce App Store screenshots of Today, item builder, Dining, Progress.

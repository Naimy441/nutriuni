# Nutriuni production redesign — plan & status

**Status: every screen is rebuilt (steps 1–9 done; step 10 done except on-device testing).** The app
compiles and lints clean, and a scripted click-through of the web build passes in light
and dark mode (onboarding → log from search, quick add and a restaurant → move, delete,
undo → every tab and settings screen). Still to do: on-device QA (step 10) and
App Store screenshots (step 11).

### Built in this pass
- Shell: `app/_layout.tsx` (splash held until goals load, nav theme from `useTheme()`,
  providers, onboarding gate from `goalsStore.onboarded`), `components/ui/TabBar.tsx`
  (blur bar, centre + opens `/log`, `useTabBarSpace()` for bottom padding).
- Today: `components/DayView.tsx` (ring + macros + fiber/sugar/sodium, "Eat it again",
  meal sections with swipe-to-delete), `WeekStrip`, `TrackedItemSheet` (move meal, log
  again, delete with Undo), `NutrientSheet` (item-by-item breakdown). Past days:
  `app/day/[date].tsx`.
- Log (`app/log.tsx`, native modal with its own sheet host + toasts): meal picker, search
  across your foods/restaurants/dishes, tabs Recent / My meals / Dining (browse a
  restaurant inline) / Quick add, running meal total footer.
- `MenuItemSheet` rewritten on the ui kit, logs to `date`/`meal`, shows its own Undo toast.
  Shared rows in `components/DiningRows.tsx`; hooks `useRestaurants`, `useQuickAdd`.
- Dining tab + restaurant page restyled. Progress (chart, streak, averages, macro split,
  history). Profile (plan card, details, targets, menu refresh, sources, feedback, erase
  all data). `app/goals.tsx`, `app/profile-edit.tsx` (shared `ProfileFields`),
  `app/sources.tsx` (citations moved to `constants/sources.ts`).
- Onboarding: welcome + value props (or skip with 2,000 cal default) → goal → sex → body
  → activity → animated plan reveal.
- Store fixes: mutations re-read the latest day after `loadDay()` (a quick double log
  could drop an item); `clearAll()`/`reset()` for erase; `remember` option and
  `saveCustomMeal`; `sourceLabel()` shows "My meal".
- Removed: the old Home/Explorer components, modals, Themed* components, template icons,
  `constants/Colors.ts`, SpaceMono font.

### Web smoke test (how the click-through above was run)
Temporarily add `"web"` to `platforms` and set `web.output` to `"single"` in app.json,
then `EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir dist`, serve `dist`
with `serve -s dist`, and drive it with Playwright at 390×844. Revert app.json afterwards.

## Done so far

### Backend / data (complete, deployed, verified)
- duke_halal builds Mobile Order + NetNutrition menus → `nutriuni/menus/` (3×/day CI).
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

## Original step list (1–9 done)

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

## Weekly meal planner

Logic in `services/planner.ts` (pure, no React); app glue in `hooks/usePlanner.ts`;
UI in `components/PlanCards.tsx`, `components/UpNext.tsx` (Today), `app/plan.tsx`
(Meal plan screen) and "Fits your plan" in the Log screen's Recent tab. Setting:
"Balance my week" (`goalsStore.planner.balanceWeek`, key `planner_settings`, on by default).

- **Week budget:** 7 × daily goal (calories and protein), weeks start Sunday like the
  week strip. A day's target = what's left of the week ÷ days left, clamped to
  ±15% of the daily goal and never below 1,200 cal (1,500 for men). Changes under
  40 cal are ignored. A day's target depends only on earlier days, so it's fixed
  before the day starts and doesn't move while you eat; today's overage moves into
  tomorrow's target.
- **Missing data:** unlogged days, and logged days under 50% of target (probably
  half-logged), count as on target, so a forgotten log never becomes extra food.
- **Protein:** a shortfall raises later days' protein targets (up to 130%), never
  below the daily goal.
- **Meals:** the day's remaining calories are split across meals not yet eaten, by
  the user's learned meal shares (28 days of fully logged days, blended with
  defaults 25/35/30/10). A meal not logged by the end of its window counts as
  skipped. Meals keep a minimum (breakfast 250, lunch 350, dinner 400) and a cap
  (45% of the day); a snack under 150 is dropped and its share goes to the meals.
- **Suggestions:** only dishes whose default order has a full NetNutrition label
  (estimates from several labels allowed, partial ones not) plus the user's saved
  meals and customised recent orders. The restaurant has to be open during the meal
  window that day, and weekday-only sections ("Monday Combos") only show on that day.
  Components such as condiments, toppings, dressings and proteins sold alone are
  excluded, and so is the Marine Lab (Beaufort) unless the user has eaten there.
  Candidates are single dishes, or a dish plus a side, drink or saved meal. They
  are ranked by calorie fit (going over counts more than coming under), protein
  shortfall, how well the food suits the meal, and familiarity, then varied by
  restaurant.
- **Checks:** `npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-planner.js`
  (196 checks, including suggestions against the bundled menus).

## Appearance and decluttering pass

- **Appearance:** Profile → Appearance (Automatic / Light / Dark), stored under
  `appearance` (`services/appearance.ts`). `useTheme()` follows it, and
  `Appearance.setColorScheme` makes native controls follow too. The splash stays up
  until it's loaded.
- **Today:** two stats (Eaten, Target) beside the ring; nutrients on one 3 × 2 grid
  (macros, then fiber/sugar/sodium); the week as one line at the bottom of the
  summary card (`weekBrief`, tap for the Meal plan); Up next shows 2 picks; meals in
  one card where empty meals are a single row; Eat it again as compact pills.
- **Consistency:** a meal is always chosen with `MealPicker` (one-line segmented);
  screens that switch content use underline `Tabs` (Log). Suggestions show at most
  one tag.
- **Dining:** no subtitle or data-source tag; restaurant rows are name + status
  ("No nutrition info" inline only where there's none); the restaurant page header
  is one row (back, icon, name, status · hours) with no coverage bar; no
  "Customizable" label.
- **Plan / Progress:** "How does the plan work?" collapses, in one card with the
  Balance switch; Progress stats are one 2 × 2 card.

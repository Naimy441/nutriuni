# nutriuni

The calorie and macro tracker built around Duke dining. nutriuni shows every
Duke dining menu with nutrition built in, lets students build their order and
watch calories update, and plans the rest of their day and week around what
they've eaten. It's on the [App Store](https://apps.apple.com/app/id6751921694)
and Google Play (`com.nutriuni.app`).

## What it does

- **Today**: calories left, macros, fiber, sugar and sodium, meals by time of
  day, and suggestions for the next meal from places open now.
- **Dining**: every Duke location with live hours, dish search across all
  menus, and filters for dishes with nutrition or that fit the user's diet.
- **Dishes**: choose sides, toppings and sizes and the totals update live. A
  full Nutrition Facts label with % Daily Values and ingredients, halal and
  vegetarian/vegan marks, and allergen warnings for the user's allergies.
- **Logging**: one tap from a menu, recents or saved meals, or quick add for
  anything off-menu. Servings, meal and day can be changed; every action has
  Undo.
- **Meal plan**: a weekly calorie and protein budget. Days that go over or
  under are balanced out across the rest of the week, within safe limits, and
  each meal gets ranked suggestions to browse.
- **Progress**: 7 and 30 day averages, logging streak, days near target and
  macro split, with a day-by-day history.
- **Different eaters**: three meals, no breakfast, an eating window, or
  Ramadan fasting (suhoor and iftar from local prayer times); vegetarian,
  vegan and halal diets; ten allergens.
- **Targets**: Mifflin-St Jeor with activity level and goal, or set by hand.
  How everything is calculated is in the app under Profile → Sources & methods.

Everything the user logs, their details and their targets stay on the phone
(AsyncStorage). There are no accounts; the only network traffic is menu data.

## Stack

- [Expo](https://expo.dev) SDK 53, React Native 0.79 (new architecture),
  TypeScript, [Expo Router](https://docs.expo.dev/router/introduction) for
  file-based navigation.
- Reanimated, Gesture Handler and `@gorhom/bottom-sheet` for sheets and
  motion; `expo-blur`, `expo-haptics`, `expo-image`.
- Firebase: Firestore holds the live menus; a scheduled Cloud Function
  (`functions/`) keeps it in sync with GitHub.
- [EAS Build](https://docs.expo.dev/build/introduction/) for release builds.

## Project layout

```
app/                Screens (Expo Router). (tabs)/ is Today, Dining, Progress
                    and Profile; log, plan, goals, preferences, sources,
                    restaurant/[name] and day/[date] are stacked on top.
components/         Feature components (DayView, MenuItemSheet,
                    NutritionLabel, PlanCards, OnboardingScreen, …)
components/ui/      The design system: AppText, Card, Sheet, Button, Chip, …
constants/          Theme tokens (light and dark), nutrient info, citations
services/           App logic without UI: the food log, goals, preferences,
                    menu loading (MenuDatabase), nutrition for an order
                    (menuNutrition), diets and allergens, the weekly planner,
                    eating schedules and fasting times
hooks/              React glue for the planner, quick add and restaurants
assets/menu/        The bundled menu snapshot (generated, see below)
functions/          Cloud Function syncMenus and its tests
scripts/            Menu sync, data checks and planner checks
screenshots/        Store screenshots and the demo data behind them
```

## Getting started

```bash
npm install
npx expo start
```

Open it in [Expo Go](https://expo.dev/go) on a phone, or press `i` / `a` for
the iOS simulator or an Android emulator. Onboarding runs on first launch; you
can skip it to start with a 2,000 cal default.

For realistic data while developing, open `nutriuni://screenshot-seed` (see
[screenshots/README.md](screenshots/README.md)). It **replaces everything on
the device** with two weeks of meals, and only works in development builds.

### Checks

```bash
npx tsc --noEmit                                   # types
npx expo lint                                      # lint
npx expo-doctor                                    # Expo config and versions
npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-menu-data.js
node .verify/scripts/verify-planner.js             # after the line above
npm --prefix functions test                        # Cloud Function sync logic
```

`verify-menu-data` checks the bundled menus against the nutrition engine
(references, plausible totals, hand-worked orders). `verify-planner` checks
weekly balancing, meal splits and suggestions (open hours, diets, allergens,
variety) against the real menus.

## Menu data

Menus come from the duke_halal repository
([Naimy441/Naimy441.github.io](https://github.com/Naimy441/Naimy441.github.io)).
A GitHub Action there scrapes Mobile Order (dishes, options, prices and hours)
and Duke NetNutrition (nutrition labels, ingredients, allergen and diet
icons) three times a day. `nutriuni/update_nutrition_library.py` keeps every
label NetNutrition has published, and `nutriuni/build_nutriuni_menus.py`
matches each dish and option to its label and commits the result to
`nutriuni/menus/`. Fix matching problems there (in the matcher or
`nutriuni_overrides.json`), never by editing `assets/menu/` by hand.

### Live updates (Firebase project `nutriuni-8166c`)

```
GitHub Action (3x/day) ──commit──▶ nutriuni/menus/ on GitHub
                                        │  polled every 15 min
                                        ▼
                    Cloud Function syncMenus (functions/)
                    verifies hashes, writes one atomic batch
                                        ▼
        Firestore  menu_meta/current  +  menu_restaurants/{id}
                                        │  get-only (firestore.rules)
                                        ▼
        App: services/MenuDatabase.ts  bundled → cached → live
```

- **syncMenus** downloads `index.json`, then only restaurants whose content
  hash changed, checks every file's bytes against the index, refuses schema
  changes and scrapes that lose most restaurants, and publishes everything in
  one batch so readers never see a half-updated menu. No Google credentials
  live in GitHub; the function uses its own service account.
- **Security:** clients can only `get` the menu documents by id. Listing and
  all writes are denied (`firestore.rules`); the function's URL rejects
  unauthenticated calls.
- **The app** opens instantly from the bundled snapshot or the last download,
  checks Firestore at launch and when returning to the foreground (at most
  every 10 minutes, or from Profile → Check for new menus), downloads only
  changed restaurants, and swaps them in all at once. Offline it keeps
  working on what it has.
- **Compatibility:** new label fields are optional, so older app versions
  ignore them. Keep `nutriuni/menus/` paths and the file layout stable.

Deploy backend changes with:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Check the live data as an anonymous client would (contents match GitHub,
documents match their versions, rules deny listing and writes):

```bash
node scripts/check-firestore-menus.mjs
```

Function logs: `firebase functions:log --only syncMenus`.

### Bundled snapshot

Each release ships a snapshot so first launch works offline. Refresh it
before building a release:

```bash
scripts/sync-menu-data.sh ../../duke_halal
```

This copies `nutriuni/menus/` into `assets/menu/` and regenerates
`assets/menu/registry.ts`, since React Native can only bundle files it sees
in static `require()` calls. Run `verify-menu-data` afterwards.

## Releasing

Releases are built on EAS under `@abdullahnaim/nutriuni`. Versions come from
`app.json` (`appVersionSource: local` in `eas.json`).

1. Refresh the bundled menus (above) and run the checks.
2. In `app.json`, bump `version` (what users see), `ios.buildNumber` and
   `android.versionCode`. Both stores reject a build number they've seen
   before, including uploads that were never released.
3. Build both platforms:

   ```bash
   eas build --platform all
   ```

4. Submit: download the `.ipa` and `.aab` from expo.dev and upload them in
   App Store Connect / Play Console, or use `eas submit -p ios --latest` and
   `eas submit -p android --latest`.

Store requirements this project is set up for:

- **iOS** builds use an Xcode 26 image (`eas.json`), which App Store
  Connect requires. Signing credentials are stored on EAS (team 3ata LLC).
- **Android** targets API 36 through `expo-build-properties` in `app.json`,
  which Google Play requires. The upload keystore is stored on EAS; Play only
  accepts bundles signed with the app's registered upload key.
- `@react-native-async-storage/async-storage` stays on ^2.2.0 and is excluded
  from Expo's version check (`package.json`): Firebase Auth needs at least 2.2,
  and the npm on EAS builders fails `npm ci` otherwise.

`android/` and `ios/` are generated by `expo prebuild` and ignored by git;
change native settings through `app.json` and config plugins instead.

Store screenshots and how to retake them are in
[screenshots/](screenshots/README.md).

## Feedback

Feature requests and bug reports come in through the form linked from
Profile → Send feedback.

*For general information only. nutriuni isn't medical advice, and nutrition
numbers are estimates from Duke's published labels.*

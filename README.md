# Welcome to your Expo app 👋

Useful Regex to remove bad food item data from Duke dining
"calories":\s*"(?:[3-9]\d{3}|[1-9]\d{4}|[12]\d{5}|300000)",

Change versionCode in package.json 

To build on android,
cd android && ./gradlew clean (optional)
Change versionCode and versionName android/app/build.gradle
cd android && ./gradlew app:bundleRelease

To build on ios,
xed ios
Change versionCode and versionName in ios/nutriuni/Info.plist and on Xcode
From the menu bar, open Product > Build
From the menu bar, open Product > Archive
Validate then Distribute

## Menu data

Menus come from the duke_halal repository, which merges Mobile Order menus
(dishes and their options) with Duke NetNutrition labels three times a day
(`nutriuni/build_nutriuni_menus.py` there) and commits them to
`nutriuni/menus/` on GitHub.

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
- **The app** opens instantly from the bundled snapshot or the last download
  (AsyncStorage), checks Firestore at launch and when returning to the
  foreground (at most every 10 minutes, or by pulling down on the Menus tab),
  downloads only changed restaurants, and swaps them in all at once. Offline
  it keeps working on what it has.

Deploy backend changes with:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Check the live data as an anonymous client would (contents match GitHub,
documents match their versions, rules deny listing and writes):

```bash
node scripts/check-firestore-menus.mjs
```

Function logs: `firebase functions:log --only syncMenus`. Sync logic tests:
`npm --prefix functions test`.

### Bundled snapshot

Each release ships a snapshot so first launch works offline. To refresh it
before building a release:

```bash
scripts/sync-menu-data.sh ../../duke_halal
```

This copies `nutriuni/menus/` into `assets/menu/` and regenerates
`assets/menu/registry.ts`. To check the bundled data against the app's
nutrition engine (references, plausible totals, hand-worked orders):

```bash
npx tsc -p scripts/tsconfig.verify.json && node .verify/scripts/verify-menu-data.js
```

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

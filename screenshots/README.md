# Store screenshots

`ios/` (iPhone 17 Pro Max, 1320×2868, the App Store's 6.9" size) and `android/` (Pixel 8, 1080×2400), the same eight screens on each:

1. Today, 2. Dining, 3. A restaurant menu (Pitchfork's, "With nutrition"), 4. A dish with an option added (Il Forno's Chicken Basil Pesto + breadstick), 5. Dish search ("basil pesto"), 6. Its Nutrition Facts label, 7. Meal plan, 8. Progress.

## Retaking them

The demo data is a student two weeks into using nutriuni, eating real Duke dining dishes (`seed.ts`). It **replaces all data** on the device, and only runs in development builds.

1. Run `npx expo start` and open the app in Expo Go on a simulator or emulator.
2. Finish or skip onboarding, then open the loader. It loads the data and lands on Today:
   - iOS: `xcrun simctl openurl booted "exp://127.0.0.1:8081/--/screenshot-seed"`
   - Android: `adb shell am start -a android.intent.action.VIEW -d "exp://<your LAN IP>:8081/--/screenshot-seed" host.exp.exponent`
3. Clean status bar (9:41, full battery and signal):
   - iOS: `xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiBars 3 --cellularBars 4 --batteryState discharging --batteryLevel 100`
   - Android: enable System UI demo mode (`adb shell settings put global sysui_demo_allowed 1`, then the `com.android.systemui.demo` broadcasts for clock, battery, network and notifications).
4. Capture with `xcrun simctl io booted screenshot <file>.png` or `adb exec-out screencap -p > <file>.png`.

Today's numbers depend on the date and the live menus, so rerun the loader on the day you shoot.

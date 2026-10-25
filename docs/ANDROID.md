# Paalam for Android (APK)

The Android app wraps the same Paalam web app in a native shell (Capacitor) and adds what a website can't do reliably on a phone: **follow-up reminders scheduled on the phone itself**, so "06:00 daily: breakfast" fires even offline or with the app closed. Calls open the phone's dialer, directions open Google Maps, and Share opens the system share sheet (WhatsApp and so on).

The project is in `android/` and is ready to build. Nothing is built until you run the command below.

## What it needs

- **A running Paalam server the phone can reach.** The app loads Paalam from `PAALAM_SERVER_URL`:
  - your Cloud Run URL (`https://…run.app`), or
  - for testing on the same Wi-Fi: `http://<your computer's local IP>:8080`, with `npm start` running on that computer. Find the IP in System Settings → Wi-Fi → Details.
- **JDK 21** and the **Android SDK** (Android Studio installs both). `ANDROID_HOME` must point at the SDK.

## Build the APK

```bash
PAALAM_SERVER_URL=https://your-paalam-url npm run android:apk
```

The APK appears at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone and open it (allow "install unknown apps" once), or with the phone plugged in:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Prefer Android Studio? `PAALAM_SERVER_URL=… npm run android:sync`, then `npm run android:open`, then Run.

## Notifications

| Where | How follow-ups reach you |
|---|---|
| Android app | Scheduled on the phone (Local Notifications). Works offline, survives restarts |
| Desktop app | Native macOS notifications while Paalam is running |
| Website | Browser notifications while open; Web Push when closed (Chrome, Edge, Firefox; iPhone only after "Add to Home Screen") |

Server-sent push to the Android app (for alerts that aren't scheduled in advance) would add Firebase Cloud Messaging: a `google-services.json` from Firebase and the `@capacitor/push-notifications` plugin. Not needed for reminders.

## App icon

The app uses Capacitor's default icon until you generate Paalam's: `npx @capacitor/assets generate --android` with `build/icon.png` copied to `assets/icon.png`.

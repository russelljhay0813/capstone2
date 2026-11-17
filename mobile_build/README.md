# PIAT Mobile App

This folder contains the Expo-based mobile client for the PIAT Academic Management System.

## What this app includes

- Student login and dashboard support
- Attendance screens and subject/student workflows
- Offline-friendly local storage and sync support
- Expo Router navigation for mobile screens

## Requirements

- Node.js 20+
- Expo CLI or Expo Go
- A running backend API (default: `http://localhost:4000`)

## Setup

1. Install dependencies:

   ```bash
   cd mobile_build
   npm install
   ```

2. Configure API URL:
   - Set the mobile app API base URL so it can reach the backend.
   - Update the configuration file or environment variable used by the mobile client.

3. Start the backend service:

   ```bash
   cd ../backend
   npm install
   npm start
   ```

4. Start the mobile app:
   ```bash
   cd ../mobile_build
   npm run start
   ```

   When running from the repository root, use `npm run mobile:start` instead. Expo must be started with `mobile_build` as its project root because the app uses Expo Router and has no root-level `App` module.

## Useful scripts

- `npm start` — start the Expo development server
- `npm run android` — launch on Android emulator/device
- `npm run ios` — launch on iOS simulator/device
- `npm run web` — run the app in browser mode

## Android release builds

Release builds use EAS Build. Install dependencies from `mobile_build`, install or use
the EAS CLI with `npx eas-cli`, and sign in to an Expo account:

```powershell
cd mobile_build
npm install
npx eas-cli login
$env:EXPO_PUBLIC_API_BASE = "https://your-deployed-piat-api.example"
npx eas-cli build --platform android --profile preview
```

The `preview` profile produces an installable APK. Download the completed build from
the EAS build page, or save it locally with
`npx eas-cli build:download --id <BUILD_ID> --path .\piat-attendance.apk`.
Transfer the APK to an Android device and open it to install; if using ADB, run
`adb install .\piat-attendance.apk`. Android may ask you to allow installation from
that file source.

For Google Play distribution, use the `production` profile, which produces an AAB:

```powershell
npx eas-cli build --platform android --profile production
```

Set `EXPO_PUBLIC_API_BASE` to the HTTPS backend URL for every release build; EAS
builds fail if it is not an HTTPS URL (including when a local `.env` points to
localhost or an emulator). This value is a public API endpoint, not an API secret.
Keep credentials and JWT secrets on the server. Increment
`expo.version` and `expo.android.versionCode` in `app.config.js` before a new
release. Install a newer APK over the existing installation to update it; preserve
the same Android package and signing credentials.

## Web PWA and offline behavior

The web portal publishes `frontend/public/manifest.webmanifest` and registers a
service worker in production. On a supported browser, use its Install App or Add
to Home Screen command. The service worker caches only the offline shell, app
icons, manifest, and same-origin build assets. It never caches navigations or
`/api` responses, so authenticated pages and student data are not stored by the
PWA cache.

The web portal requires a network connection to load faculty rosters. Offline
attendance entry and queued synchronization remain in the native Android app,
which uses SQLite, secure token storage, and the existing retrying sync queue.

## Project structure

- `app/` — route-based screens and app entry points
- `src/` — app logic, API integration, storage, and state handling
- `assets/` — static assets and images

## Notes

- When testing on a physical device, use your computer’s local network IP address rather than `localhost`.
- The mobile client must connect to the backend API to function properly.
- Ensure the backend server is running before opening the mobile app.

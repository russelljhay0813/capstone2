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
   npm start
   ```

## Useful scripts

- `npm start` — start the Expo development server
- `npm run android` — launch on Android emulator/device
- `npm run ios` — launch on iOS simulator/device
- `npm run web` — run the app in browser mode

## Project structure

- `app/` — route-based screens and app entry points
- `src/` — app logic, API integration, storage, and state handling
- `assets/` — static assets and images

## Notes

- When testing on a physical device, use your computer’s local network IP address rather than `localhost`.
- The mobile client must connect to the backend API to function properly.
- Ensure the backend server is running before opening the mobile app.

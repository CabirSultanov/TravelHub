# TravelHub Driver MobileApp

Expo React Native application for TravelHub taxi drivers, using the same API and database as the website. Access tokens remain in SecureStore.

A fresh app launch or full reload requires sign-in. The previous saved token is discarded without waiting for an API session-restore request. Switching tabs or briefly backgrounding the running app (for example, to call a passenger) keeps the current session. This does not change website sign-in.

## Driver workflow

- **Available**: route, class and fare first. Accept opens Active; Decline removes the request only for this driver. An existing active ride takes priority over new requests.
- **Active**: pickup point, passenger phone and `Call passenger`. `I've arrived` updates the passenger's screen; `Complete ride` asks for confirmation and shows the completed trip with links to History or the next request.
- **History**: compact completed trips with local dates and expandable details.
- **Profile**: account, real role, phone, assigned taxi service and local logout.

Available and Active refresh serially every 10 seconds while focused and foregrounded. Returning to a tab or pulling down refreshes immediately. Network errors keep the last details visible but disable ride actions until a fresh read succeeds. Expired sessions return to sign-in; denied driver access clears ride details. After an uncertain action response, the app checks server state before another action.

Only assigned TaxiDriver accounts dispatch rides; Admin/SuperAdmin can still enter the app but cannot operate rides. There are no invented orders, GPS/ETA, earnings estimates or payment changes. The existing mobile fare label remains AZN; no currency conversion is performed.

## Mobile checks

From `MobileApp`:

```powershell
npm run typecheck
node scripts/test-driver-state.cjs
node scripts/test-driver-feed.cjs
node scripts/test-admin-control.cjs
node scripts/test-auth-session.cjs
node scripts/test-api-config.cjs
```

The checks use Node and the installed TypeScript compiler, with isolated data and no live API/database. On an emulator, verify Accept → Active → I've arrived → Complete confirmation → result → History, then Profile → Log out, using designated test orders only.

## Run on a physical phone

Requirements:

- Expo Go installed on the phone
- phone and PC connected to the same Wi-Fi/private network
- .NET SDK and Node.js installed on the PC

### Terminal 1 — backend

From the repository root, start the same API used by the website and mobile app:

```powershell
dotnet run --project TravelHub.Api --launch-profile mobile
```

### Terminal 2 — web (optional)

```powershell
cd TravelHub.Client
npm run dev
```

The website is available at `http://localhost:5173`.

### Terminal 3 — mobile

```powershell
cd MobileApp
npm install
npx expo start --lan
```

Then open Expo Go and scan the QR code. TravelHub Driver automatically derives the PC LAN host from Expo and connects to the API on port `5207`. Normal LAN development does not require `.env`, `ipconfig`, or manually copying an IP address.

If you created `MobileApp/.env` for an older setup, delete or rename it to use automatic discovery again. An explicit `EXPO_PUBLIC_API_URL` intentionally takes priority.

Sign in with a `TaxiDriver`, `Admin`, or `SuperAdmin` account. Other TravelHub roles are intentionally denied access to the Driver app.

## Troubleshooting

### Android emulator: reliable local connection

Start the emulator first and wait for Android to finish booting. In `MobileApp`, run:

```powershell
npx expo start --localhost
```

Press `a` to open the project. Expo CLI forwards Metro's port through ADB; the app automatically uses Android Emulator's built-in host alias `http://10.0.2.2:5207` for the API when Metro uses localhost. No `.env` is needed. Keep the same backend running in its separate terminal. Physical phones should continue using the LAN instructions above.

`a` opens the app, but is not a guaranteed fresh launch: Android/Expo Go can bring an existing app or emulator snapshot back to the foreground. Use `r` for a full reload and a fresh sign-in. Fast Refresh while editing is not a full reload either.

If `Cannot connect to Expo CLI` appears after restarting Metro or restoring an emulator snapshot, the old Fast Refresh connection has been lost. Dismissing the warning does not reconnect it. Open the project from the current terminal with `a`, then reload with `r`. If the terminal says `No apps connected`, close Expo Go from Android's recent apps and reopen with `a`. Do not clear Expo Go's app data or change the database.

This fixes the development connection path, not all emulator performance problems. Check host memory and emulator resources separately if scrolling remains slow.

`netsimd` is part of Android Emulator; lines marked `I` are informational logs, not TravelHub errors. On Windows, letting Expo start a stopped emulator can open additional console windows. Start the emulator from Android Studio's Device Manager before pressing `a`. When finished, stop Expo with `Ctrl+C`, then close the emulator. Do not delete SDK components or disable networking to hide the window.

### QR code does not open

Confirm that Expo Go is installed, both devices are on the same Wi-Fi, and Expo was started with `npx expo start --lan`. Some Wi-Fi networks isolate connected devices; Expo tunnel can help Metro connectivity, but it does not expose the local TravelHub API.

### App opens but cannot reach the API

Confirm `http://localhost:5207/health` works on the PC and that the backend was started with the `mobile` profile. When Windows asks, allow .NET access on **Private networks**. Do not disable Windows Firewall.

### Optional manual API override

Only if automatic discovery is unavailable, create `MobileApp/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5207
```

Restart Expo after changing this value. Do not use `localhost` for a physical phone because it refers to the phone itself.

Access tokens are stored with `expo-secure-store`. Native refresh-token support is a later dedicated phase because the current backend refresh flow relies on an HTTP-only browser cookie.

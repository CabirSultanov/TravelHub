# TravelHub Driver MobileApp

Expo React Native application for TravelHub taxi drivers, using the same API and database as the website. Access tokens remain in SecureStore.

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

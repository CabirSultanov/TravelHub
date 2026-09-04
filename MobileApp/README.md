# TravelHub Driver MobileApp

Expo React Native application for TravelHub taxi drivers. It includes sign-in, secure access-token storage, session restoration, and placeholder driver tabs. Ride actions are intentionally not implemented yet.

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

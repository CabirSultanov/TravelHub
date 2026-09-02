# TravelHub Driver

Expo React Native foundation for TravelHub taxi drivers. This phase includes sign-in, secure access-token storage, session restoration, and placeholder driver tabs. Ride actions are intentionally not implemented yet.

## Run with Expo Go

1. Install Node.js LTS and Expo Go on your phone.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set a LAN address reachable from your phone:

   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:5207
   ```

4. Start the TravelHub API from the repository root.
5. Start Expo:

   ```bash
   npx expo start
   ```

6. Scan the QR code using Expo Go.

Do not use `localhost` in `.env` for a physical phone: it refers to the phone itself, not to your computer. The phone and computer normally need to be on the same local network.

Access tokens are stored with `expo-secure-store`. Native refresh-token support is a later dedicated phase because the current backend refresh flow relies on an HTTP-only browser cookie.

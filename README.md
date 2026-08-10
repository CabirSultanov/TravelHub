# TravelHub

## Google Maps Setup

Taxi booking uses Google Maps JavaScript and Geocoding APIs in the frontend, and Google Routes API in the backend.

1. Create a Google Cloud project and enable billing.
2. Enable Maps JavaScript API.
3. Enable Geocoding API for map-click reverse geocoding.
4. Enable Routes API.
5. Create a browser API key for the frontend and restrict it by HTTP referrer, including localhost for development.
6. Create a backend API key for Routes API and restrict it to only the APIs it needs.
7. In `TravelHub.Client/.env`, set:

   ```env
   VITE_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_RESTRICTED_KEY
   ```

8. For the backend, use user secrets:

   ```bash
   dotnet user-secrets set "GoogleMaps:ApiKey" "YOUR_ROUTES_API_KEY" --project TravelHub.Api
   ```

Do not commit real API keys.

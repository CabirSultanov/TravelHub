# TravelHub - Web & Mobile Hotel and Taxi Platform

TravelHub is a full-stack travel platform that combines hotel accommodation and taxi services in one system. It includes a React website for customers and business owners, an Expo React Native app for taxi drivers, and a shared ASP.NET Core API backed by one SQL database.

> **Project scope:** payment flows are educational simulations. TravelHub records payment state and masked card details, but it does not connect to a real bank or payment gateway.

## Project Benefits

- **All-in-One Travel:** Hotels and taxi services are available in one platform.
- **Hotel Booking:** Users can search hotels, view rooms, select dates, and create bookings.
- **Taxi Booking:** Users can choose a taxi service, car class, pickup point, and dropoff point.
- **Live Taxi Dispatch:** Requests are offered to drivers from the selected taxi service; the first successful acceptance assigns the ride, and the customer sees each trip stage.
- **Driver Mobile App:** Taxi drivers can accept or decline requests, mark arrival, complete rides, review history, and manage their session from Expo Go or an Android emulator.
- **Interactive Maps:** Google Maps supports taxi pickup/dropoff selection and route preview.
- **Role-Based Workspaces:** Customers, hotel owners, taxi owners, drivers, administrators, and super administrators receive interfaces suited to their responsibilities.
- **User Accounts:** Registration, email confirmation, password recovery, profile editing, saved cards, and booking history are included.
- **Booking Management:** Hotel and taxi bookings show payment and cancellation statuses.
- **Administration:** Admin and SuperAdmin users can manage hotels, rooms, taxi services, owners, drivers, and user access.

---

## Project Structure

```text
TravelHub/
├── TravelHub.Api/              # ASP.NET Core backend
│   ├── Controllers/            # REST API controllers
│   ├── Models/                 # EF Core entities
│   ├── DTO/                    # Request/response contracts
│   ├── Services/               # Business rules, tokens, maps, payments
│   ├── Data/                   # DbContext, startup migration/seed logic
│   └── Migrations/             # EF Core migrations
├── TravelHub.Api.Tests/        # Backend xUnit tests
├── TravelHub.Client/           # React + TypeScript frontend
│   ├── public/                 # Static assets and favicon
│   └── src/                    # Pages, features, API client, utilities
├── MobileApp/                  # Expo Router + React Native driver application
├── .github/workflows/          # GitHub Actions CI
├── images/                     # Legacy local uploads served by the API when present
├── docs/                       # Additional project documentation
├── TravelHub.sln               # .NET solution
└── README.md
```

---

## Hotel owner workspace

HotelOwner accounts have a **My hotels** link to `/owner`. Normal login opens the workspace; signing in for a specific page preserves that destination. An administrator still assigns hotels and creates/deletes hotel properties.

- **Overview:** planned paid arrivals/departures using the Baku calendar date, pending payments for current/upcoming stays, and the next five paid arrivals. These are scheduled stays, not actual check-in events or bank revenue.
- **Bookings:** server-scoped, paginated read-only guest reservations, contact details, date/status/search filters and saved totals. No owner payment/cancellation actions or card details.
- **Hotels & rooms:** existing hotel/photo/room editors, including open/closed sales. Price edits affect new bookings only. Types with booking history cannot be deleted; current/future paid and pending bookings protect room stock and saved capacity. Existing minimum room-type/guest-place rules remain.
- **Reviews:** read-only existing ratings and paginated feedback for a selected owned hotel.

Overview and the open booking list refresh every 30 seconds while the browser tab is visible. Other reads refresh on entry/return and manually. Cancelled hotel bookings are retained; the previous hourly-age cleanup worker is no longer registered. Previously deleted bookings cannot be recovered.

Protected read APIs: `GET /api/owner/hotels`, `/api/owner/overview`, `/api/owner/bookings`, `/api/owner/bookings/{id}`. Ownership comes from the authenticated account and current hotel assignment. This feature adds no migration or dependency. Test with isolated data; do not start the API against the working database for verification because startup may apply pending migrations from other features.

## User roles

| Role | Main responsibility |
| --- | --- |
| `User` | Search, book, pay, track trips, and leave reviews |
| `HotelOwner` | Manage assigned hotels and rooms; monitor bookings and reviews |
| `TaxiOwner` | Manage drivers assigned to an owned taxi service |
| `TaxiDriver` | Accept and complete rides in the mobile application |
| `Admin` | Manage hotels, taxi services, owners, and drivers |
| `SuperAdmin` | Full administration plus user and administrator management |

## Technology Stack

| Area | Implementation |
| --- | --- |
| Web frontend | React 19 + TypeScript 5 + Vite 6 |
| Mobile app | Expo 57 + Expo Router + React Native 0.86 + TypeScript 6 |
| Backend | ASP.NET Core Web API (.NET 8) |
| Data access | Entity Framework Core 8 |
| Database | SQL Server / Azure SQL |
| Maps | Google Maps JavaScript API + Google Routes API |
| Authentication | JWT access tokens, rotating refresh tokens, role-based authorization |
| Secure mobile storage | Expo SecureStore |
| Media and email | Cloudinary + MailKit / Gmail SMTP |
| Testing | xUnit, EF Core InMemory, Vitest |
| CI | GitHub Actions |

---

## Setup & Development

### 1) Backend

```bash
dotnet restore
dotnet run --project TravelHub.Api
```

Backend development URL:

```text
http://localhost:5207
```

Swagger UI is available in development mode from the backend launch profile.

### 2) Database

The API uses SQL Server through Entity Framework Core. Migrations are applied during API startup. They can also be applied manually if the EF CLI is installed:

```bash
dotnet ef database update --project TravelHub.Api
```

### 3) Frontend

```bash
cd TravelHub.Client
npm install
npm run dev
```

Frontend development URL:

```text
http://localhost:5173
```

The Vite dev server proxies `/api`, `/health`, and `/images` to the backend.

### 4) Mobile Driver App

`MobileApp` is the Expo React Native application used for taxi dispatch. An assigned `TaxiDriver` receives four tabs:

- **Available:** ride requests from the driver's taxi service, with `Accept` and `Decline` actions.
- **Active:** the accepted ride, passenger contact details, `I've arrived`, and `Complete ride`.
- **History:** completed rides and their details.
- **Profile:** account, role, assigned taxi service, and local logout.

Available and active rides refresh while their screens are open. Ride acceptance is protected on the server, so if several drivers see the same request, only the first successful acceptance receives it. Admin and SuperAdmin accounts may authenticate in the current app but cannot perform driver ride actions.

Run web and mobile against the same local API using three terminals.

**Terminal 1 — backend**

```powershell
dotnet run --project TravelHub.Api --launch-profile mobile
```

**Terminal 2 — website**

```powershell
cd TravelHub.Client
npm run dev
```

**Terminal 3 — Expo Go**

```powershell
cd MobileApp
npm install
npx expo start --lan
```

Open the website at `http://localhost:5173`. On a phone connected to the same Wi-Fi, open Expo Go and scan the QR code. MobileApp automatically gets the PC LAN host from Expo and connects to the same TravelHub API on port `5207`; `.env`, `ipconfig`, and manually copied IP addresses are not required for normal LAN development.

If an older `MobileApp/.env` exists, remove or rename it to return to automatic discovery; an explicit API URL intentionally takes priority.

The app stores only its access token in the device's secure storage. Native refresh-token support is intentionally deferred until a later phase with dedicated backend support.

### 5) Mobile troubleshooting

If Expo opens but the API is unavailable, confirm the backend is running with the `mobile` profile and that `http://localhost:5207/health` works on the PC. Allow .NET only on **Private networks** when Windows Firewall prompts. If automatic discovery cannot work on a specific network, create `MobileApp/.env` with `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5207`, then restart Expo. This is a fallback only; do not commit it.

### 6) Environment Configuration

Create `TravelHub.Client/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_browser_google_maps_key
```

Set backend secrets with local placeholders replaced:

```bash
dotnet user-secrets set "Jwt:Key" "your-jwt-key-at-least-32-characters" --project TravelHub.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-sql-server-connection-string" --project TravelHub.Api
dotnet user-secrets set "GoogleMaps:ApiKey" "your-backend-google-maps-key" --project TravelHub.Api
dotnet user-secrets set "Email:SenderEmail" "your-gmail-address@gmail.com" --project TravelHub.Api
dotnet user-secrets set "Email:Username" "your-gmail-address@gmail.com" --project TravelHub.Api
dotnet user-secrets set "Email:AppPassword" "your-gmail-app-password" --project TravelHub.Api
dotnet user-secrets set "Cloudinary:CloudName" "YOUR_CLOUD_NAME" --project TravelHub.Api
dotnet user-secrets set "Cloudinary:ApiKey" "YOUR_API_KEY" --project TravelHub.Api
dotnet user-secrets set "Cloudinary:ApiSecret" "YOUR_API_SECRET" --project TravelHub.Api
```

Optional SuperAdmin seed:

```bash
dotnet user-secrets set "SeedSuperAdmin:Name" "Super Admin" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Email" "admin@gmail.com" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:PhoneNumber" "+994501234567" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Password" "your-local-super-admin-password" --project TravelHub.Api
```

Do not commit `.env` files or real credentials.

New registrations also require Gmail email confirmation. TravelHub sends a six-digit code through Gmail SMTP; the default SMTP host is `smtp.gmail.com` on port `587` with STARTTLS. Optionally override `Email:SenderName`, `Email:SmtpHost`, or `Email:SmtpPort` through User Secrets or environment variables. Use a Gmail App Password, never your normal Gmail password.

### Website password recovery

On **Sign in**, choose **Forgot password?**, enter your account Gmail address, verify the emailed six-digit code, then enter and confirm a new password. The site keeps its existing password requirements. Recovery uses the same SMTP configuration above; no new mail provider or credentials are required. A separate notification is sent after a successful password change. Registration/email confirmation, roles and MobileApp are unchanged.

- Codes expire after 10 minutes, allow at most five guesses, and can be requested once per account per minute. A new code invalidates the previous code/recovery grant. Verification issues a single-use, ten-minute reset grant kept only in page memory, never in local storage or URLs. Reloading the page requires starting recovery again.
- Unknown, blocked and existing accounts receive the same request response, including delivery failures. Responses are padded to five seconds with a four-second SMTP timeout. Delivery problems are reported only in sanitized server logs; check those logs and Spam if mail does not arrive. No password/code/token is logged.
- Recovery endpoints share a limit of ten requests per minute per remote IP using ASP.NET Core's built-in limiter. Behind a reverse proxy this is the address seen by the API; configure trusted proxy forwarding/deployment-level limits before scaling. The per-account cooldown and guess count are persistent and concurrency-protected in SQL.
- Password reset revokes all unexpired refresh tokens, including rotation-replay tokens. Existing access JWTs keep their configured short expiry; this change does not redesign token validation or automatically sign the user in. Unconfirmed users still need the existing email-confirmation flow after resetting; blocked users cannot recover until unblocked.
- Migration `20260915124448_AddPasswordRecovery` adds only `PasswordRecoveries` (one row per account, storing hashes, expiry and attempt/concurrency state). It does not alter existing user/password/role columns or delete account data. Deleting an account also removes its recovery row. **API startup applies pending migrations to its configured database**: review the migration and generated SQL before restarting a deployment. Do not use a production-connected API for test resets; automated tests use an isolated in-memory database and fake mail delivery.

These protections follow the [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Use HTTPS in deployment, as for login.

New hotel, room, and taxi image uploads use Cloudinary. Configure the `Cloudinary:CloudName`, `Cloudinary:ApiKey`, and `Cloudinary:ApiSecret` User Secrets locally, or set `Cloudinary__CloudName`, `Cloudinary__ApiKey`, and `Cloudinary__ApiSecret` in production. Existing `/images/...` URLs remain served by TravelHub for backwards compatibility.

---

## Core Functionality

### Hotels

- Browse hotels by city and select stay dates when booking a room.
- View public hotel ratings, average scores, and paginated guest reviews.
- Registered users can rate hotels and add or edit an optional written review.
- Validate date ranges so check-out must be after check-in.
- Preserve search state with query-based URLs.
- Open hotel detail pages.
- View available rooms.
- Select a room and create a hotel booking.
- Pay or cancel pending hotel bookings.

### Taxi

- Browse taxi services.
- Select taxi car classes with different prices per kilometer.
- Choose pickup and dropoff points on Google Maps.
- Preview route distance and estimated price.
- Request a ride and track `Finding driver`, `Driver on the way`, `Driver arrived`, and `Completed` stages on a dedicated page.
- Show the assigned driver's name and phone after acceptance.
- Allow cancellation only while a request is waiting for a driver.
- Record the simulated payment when a driver accepts the ride; no real bank transaction is performed.
- Rate a completed ride with stars and an optional comment.

### Taxi Driver App

- Show only requests from the driver's assigned taxi service.
- Atomically assign a request to the first driver who accepts it.
- Let a driver decline a request without hiding it from other drivers.
- Progress an accepted ride through arrival and completion.
- Keep access tokens in Expo SecureStore and restore valid sessions securely.

### User Account

- Register and log in.
- Confirm email with a six-digit code and recover a forgotten password by email.
- View and edit profile data.
- Change password when needed.
- Save and delete payment cards.
- View hotel and taxi booking history.
- Track statuses such as `PendingPayment`, `Paid`, and `Cancelled`.

### Administration

- Admin and SuperAdmin users can manage hotels, rooms, taxi services, and car classes.
- Administrators can assign hotel owners, taxi owners, and taxi drivers through dedicated management sections.
- Taxi owners retain driver management for their own service.
- SuperAdmin users can view all account roles, create or demote admins, block or unblock eligible users, and delete accounts where allowed.

---

## System Architecture

```text
React + TypeScript Web (:5173)       Expo React Native Mobile
               \                     /
                \    REST / HTTP    /
                 ASP.NET Core API (:5207)
                           |
                        EF Core
                           |
                  SQL Server / Azure SQL

          Google Maps / Routes API · Cloudinary · SMTP
```

The website and MobileApp are separate clients of the same ASP.NET Core API and the same database. The backend owns authentication, authorization, validation, booking and dispatch rules, simulated payment status changes, Google Routes calls, media integration, and database access. The mobile application never uses a second backend or database.

---

## Authentication & Security

- JWT authentication is used for protected API requests.
- Refresh tokens are stored through HTTP-only cookies and rotated by the backend.
- Passwords are hashed with ASP.NET Core `PasswordHasher<AppUser>`.
- Roles are `User`, `HotelOwner`, `TaxiOwner`, `TaxiDriver`, `Admin`, and `SuperAdmin`.
- Backend authorization protects admin-only actions.
- Driver endpoints verify the `TaxiDriver` role and the driver's assigned taxi service.
- Email confirmation and password recovery codes are time-limited and stored as hashes.
- Emails are normalized, unique, and limited to `@gmail.com`.
- Passwords require length, uppercase, lowercase, number, and special character rules.
- Azerbaijan phone numbers are normalized to `+994`.
- Hotel booking date ranges are validated on the frontend and backend.
- Secrets are kept in user secrets, environment variables, GitHub secrets, or ignored `.env` files.

---

## Main Entities

```text
AppUser
RefreshToken
PasswordRecovery
Hotel
HotelRoom
BookingRequest
HotelReview
SavedPaymentCard
TaxiService
TaxiCarClass
TaxiBooking
TaxiBookingDriverDecline
```

---

## API Overview

| API Area | Purpose |
| --- | --- |
| Auth | Registration, email confirmation, login, refresh, logout, profile, password recovery |
| Admin | Hotel/taxi ownership, driver assignment, admin creation, blocking, account management |
| Owner | Hotel-owner overview, bookings, hotels, rooms, and reviews |
| Hotels | Hotel listing and hotel management |
| Rooms | Hotel room listing and room management |
| Bookings | Hotel booking, payment, cancellation, history |
| Payment Cards | Saved card creation, list, deletion |
| Taxi Services | Taxi service and car class management |
| Taxi Routes | Taxi route preview with Google Routes |
| Taxi Bookings | Customer requests, live status, cancellation, history, ride reviews |
| Driver Taxi Bookings | Available, active, history, accept, decline, arrive, complete |
| Health | API and database health checks |

---

## Routing & Deep Links

TravelHub keeps meaningful page state in the URL so search and navigation can be refreshed or shared.

```text
/hotels?city=Baku&checkIn=2026-09-05&checkOut=2026-09-06
/hotels/{id}?roomId={id}&checkIn=2026-09-05&checkOut=2026-09-06
/taxi?serviceId={id}&class=Comfort
/taxi/rides/{id}
/owner
/auth?mode=login
```

Invalid hotel date ranges from query parameters are normalized before use.

---

## Running Tests

Backend:

```bash
dotnet test TravelHub.Api.Tests/TravelHub.Api.Tests.csproj
```

Frontend:

```bash
cd TravelHub.Client
npm test
```

Frontend build:

```bash
cd TravelHub.Client
npm run build
```

Mobile application:

```bash
cd MobileApp
npm run typecheck
node scripts/test-driver-state.cjs
node scripts/test-driver-feed.cjs
```

---

## Continuous Integration

GitHub Actions automatically runs backend build/tests and frontend build/tests on pull requests and pushes to `main`.

Frontend CI build expects this GitHub secret:

```text
VITE_GOOGLE_MAPS_API_KEY
```

---

## Author

Cabir Sultanov

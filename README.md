# TravelHub - Hotel & Taxi Booking Platform

TravelHub is a full-stack travel platform that combines hotel accommodation and taxi services in a single application. Users can search for hotels, book rooms, arrange taxi rides, manage bookings, and use Google Maps for location-based taxi routes.

## Project Benefits

- **All-in-One Travel:** Hotels and taxi services are available in one platform.
- **Hotel Booking:** Users can search hotels, view rooms, select dates, and create bookings.
- **Taxi Booking:** Users can choose a taxi service, car class, pickup point, and dropoff point.
- **Interactive Maps:** Google Maps supports taxi pickup/dropoff selection and route preview.
- **User Accounts:** Registration, login, profile editing, saved cards, and booking history are included.
- **Booking Management:** Hotel and taxi bookings show payment and cancellation statuses.
- **Administration:** Admin and SuperAdmin users can manage hotels, rooms, taxi services, and user access.

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
├── .github/workflows/          # GitHub Actions CI
├── images/                     # Uploaded/static images served by API
├── docs/                       # Additional project documentation
├── TravelHub.sln               # .NET solution
└── README.md
```

---

## Technology Stack

| Area | Implementation |
| --- | --- |
| Frontend | React 19 + TypeScript |
| Build Tool | Vite |
| Backend | ASP.NET Core Web API (.NET 8) |
| ORM | Entity Framework Core |
| Database | SQL Server / Azure SQL |
| Maps | Google Maps JavaScript API + Google Routes API |
| Authentication | JWT access tokens + refresh tokens |
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

### 4) Environment Configuration

Create `TravelHub.Client/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_browser_google_maps_key
```

Set backend secrets with local placeholders replaced:

```bash
dotnet user-secrets set "Jwt:Key" "your-jwt-key-at-least-32-characters" --project TravelHub.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-sql-server-connection-string" --project TravelHub.Api
dotnet user-secrets set "GoogleMaps:ApiKey" "your-backend-google-maps-key" --project TravelHub.Api
```

Optional SuperAdmin seed:

```bash
dotnet user-secrets set "SeedSuperAdmin:Name" "Super Admin" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Email" "admin@gmail.com" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:PhoneNumber" "+994501234567" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Password" "your-local-super-admin-password" --project TravelHub.Api
```

Do not commit `.env` files or real credentials.

---

## Core Functionality

### Hotels

- Search hotels by city and stay dates.
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
- Create taxi bookings.
- Pay or cancel pending taxi bookings.

### User Account

- Register and log in.
- View and edit profile data.
- Change password when needed.
- Save and delete payment cards.
- View hotel and taxi booking history.
- Track statuses such as `PendingPayment`, `Paid`, and `Cancelled`.

### Administration

- Admin and SuperAdmin users can create, edit, and delete hotels.
- Admin and SuperAdmin users can create, edit, and delete hotel rooms.
- Admin and SuperAdmin users can upload hotel and room images.
- Admin and SuperAdmin users can manage taxi services and car classes.
- SuperAdmin users can create admins, block/unblock users, delete accounts, and demote admins.

---

## System Architecture

```text
React + TypeScript Client
          |
          | REST / HTTP
          v
ASP.NET Core Web API
          |
          | EF Core
          v
SQL Server / Azure SQL

Google Maps API
```

TravelHub uses a client-server architecture. The React client handles the UI and sends REST requests to the ASP.NET Core API. The backend owns authentication, validation, booking rules, payment status changes, Google Routes calls, and database access. EF Core stores application data in SQL Server.

---

## Authentication & Security

- JWT authentication is used for protected API requests.
- Refresh tokens are stored through HTTP-only cookies and rotated by the backend.
- Passwords are hashed with ASP.NET Core `PasswordHasher<AppUser>`.
- Roles are `User`, `Admin`, and `SuperAdmin`.
- Backend authorization protects admin-only actions.
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
Hotel
HotelRoom
BookingRequest
SavedPaymentCard
TaxiService
TaxiCarClass
TaxiBooking
```

---

## API Overview

| API Area | Purpose |
| --- | --- |
| Auth | Registration, login, refresh, logout, profile |
| Admin | Admin creation, blocking, account management |
| Hotels | Hotel listing and hotel management |
| Rooms | Hotel room listing and room management |
| Bookings | Hotel booking, payment, cancellation, history |
| Payment Cards | Saved card creation, list, deletion |
| Taxi Services | Taxi service and car class management |
| Taxi Routes | Taxi route preview with Google Routes |
| Taxi Bookings | Taxi booking, payment, cancellation, history |
| Health | API and database health checks |

---

## Routing & Deep Links

TravelHub keeps meaningful page state in the URL so search and navigation can be refreshed or shared.

```text
/hotels?city=Baku&checkIn=2026-09-05&checkOut=2026-09-06
/hotels/{id}?roomId={id}&checkIn=2026-09-05&checkOut=2026-09-06
/taxi?serviceId={id}&class=Comfort
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

# TravelHub

### Full-Stack Hotel & Taxi Booking Platform

TravelHub is a travel management web application that combines hotel booking and taxi booking in one place. Users can search hotels, choose rooms, create bookings, select taxi services, build pickup and dropoff routes on Google Maps, and manage their trips from a personal profile. The project includes a React frontend, an ASP.NET Core Web API backend, SQL Server persistence, role-based access, validation, automated tests, and GitHub Actions CI.

The goal of TravelHub is to make the main steps of a trip easier to manage from a single application: where to stay, how to get there, how much it costs, and what has already been booked.

## About TravelHub

TravelHub is built as a single travel platform for hotel discovery, room booking, taxi route planning, payment status tracking, saved payment cards, user profile management, and administration. The frontend provides a user-friendly booking interface, while the backend keeps business rules, validation, authentication, database access, and integrations in one REST API.

## Project Benefits

- **All-in-One Travel Experience** - hotels and taxi services are managed in one application.
- **Simple Hotel Booking** - users can search by city and dates, open hotel details, select rooms, and create bookings.
- **Convenient Taxi Booking** - users can choose a taxi service, select a car class, set pickup and dropoff points, and create a booking.
- **Interactive Maps** - Google Maps is used for taxi pickup/dropoff selection and route preview.
- **Secure Accounts** - registration, login, JWT authentication, password hashing, refresh tokens, and role-based access are implemented.
- **Booking Management** - users can view hotel and taxi bookings with payment statuses.
- **Administration** - privileged users can manage hotels, rooms, taxi services, admins, and user access.

## Current Status

| Component | Status |
| --- | --- |
| Frontend | Implemented |
| Backend API | Implemented |
| Database | Implemented |
| Authentication | Implemented |
| Hotel Booking | Implemented |
| Taxi Booking | Implemented |
| Saved Cards | Implemented |
| Tests | Available |
| CI | GitHub Actions |

## Project Structure

```text
TravelHub/
|-- TravelHub.Api/          # ASP.NET Core REST API
|-- TravelHub.Api.Tests/    # Backend xUnit tests
|-- TravelHub.Client/       # React + TypeScript frontend
|-- .github/workflows/      # GitHub Actions CI workflow
|-- images/                 # Uploaded/static image storage used by the API
|-- docs/                   # Project documentation
|-- TravelHub.sln           # .NET solution
`-- README.md
```

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript |
| Build Tool | Vite |
| Frontend Tests | Vitest |
| Backend | ASP.NET Core Web API (.NET 8) |
| Language | C# |
| ORM | Entity Framework Core |
| Database | SQL Server / Azure SQL compatible connection |
| Maps | Google Maps JavaScript API, Google Routes API |
| Authentication | JWT access tokens and refresh tokens |
| Backend Tests | xUnit, EF Core InMemory |
| CI | GitHub Actions |

## System Architecture

```text
React + TypeScript Client
          |
          | HTTP / REST
          v
ASP.NET Core Web API
          |
          | Entity Framework Core
          v
SQL Server / Azure SQL

Google Maps APIs <-> TravelHub
```

TravelHub uses a client-server architecture. The React client sends HTTP requests to the ASP.NET Core API. The backend contains authentication, authorization, validation, booking rules, payment status handling, and database access through Entity Framework Core. Google Maps is used by the frontend for map interaction and by the backend for taxi route calculation.

## Core Functionality

### Hotels

- View hotel cards on the home page and hotels page.
- Search and filter hotels by city.
- Use check-in and check-out dates in hotel search.
- Preserve hotel search state in URL query parameters.
- Open hotel detail pages with shareable URLs.
- View rooms for a selected hotel.
- Select a room and create a hotel booking.
- Validate booking date ranges so check-out must be after check-in.
- Upload and manage hotel and room images through admin actions.

### Taxi

- View available taxi services.
- Select a taxi service and car class.
- Create, edit, and delete taxi services as an admin or super admin.
- Set pickup and dropoff points with Google Maps.
- Preview taxi route, distance, and estimated price.
- Create taxi bookings.
- Pay or cancel pending taxi bookings.
- Track taxi booking statuses in the profile page.

### User Account

- Register and log in with a personal account.
- Use JWT authentication with refresh token support.
- View the current user profile.
- Edit name, Gmail address, phone number, and optional password.
- Save and delete payment cards.
- View hotel booking history.
- View taxi booking history.
- See booking statuses such as `PendingPayment`, `Paid`, and `Cancelled`.

### Administration

- `Admin` and `SuperAdmin` users can manage hotels.
- `Admin` and `SuperAdmin` users can manage hotel rooms.
- `Admin` and `SuperAdmin` users can upload hotel and room images.
- `Admin` and `SuperAdmin` users can manage taxi services and car classes.
- `SuperAdmin` users can create admins, block/unblock users, delete accounts, and demote admins.
- Protected admin actions are enforced by backend role-based authorization.

## Authentication & Authorization

TravelHub uses JWT authentication for protected API calls. Login and registration return an access token, while refresh tokens are stored as HTTP-only cookies and rotated through the refresh endpoint. Passwords are stored as hashes using ASP.NET Core `PasswordHasher<AppUser>`.

The application uses three roles:

- `User` - standard account for booking hotels and taxis.
- `Admin` - can manage travel content such as hotels, rooms, and taxi services.
- `SuperAdmin` - can manage admins and user access in addition to admin features.

## Validation & Security

TravelHub includes validation on both frontend and backend where business rules require it:

- Email is normalized and must be unique.
- Registration and profile email updates allow only `@gmail.com` addresses.
- Passwords require at least 8 characters, uppercase, lowercase, number, and special character.
- Azerbaijan phone numbers are normalized to the `+994` format.
- Hotel booking date ranges require check-out to be after check-in.
- Taxi coordinates are validated before route calculation and booking.
- Saved card input is validated before a local card token is generated.
- Blocked users cannot use protected API actions.
- Secrets are expected to come from user secrets, environment variables, or local `.env` files.
- Real `.env` files and API keys should not be committed to Git.

This is a coursework project, so payment card handling is simulated inside the application. It does not integrate with a real payment provider.

## Main Entities

```text
AppUser
|-- RefreshToken
|-- SavedPaymentCard
|-- BookingRequest
`-- TaxiBooking

Hotel
`-- HotelRoom

TaxiService
`-- TaxiCarClass
```

Main backend models include:

- `AppUser` - registered user with role, phone number, password hash, and blocked status.
- `RefreshToken` - hashed refresh token records for session rotation.
- `Hotel` - hotel data such as name, city, description, and image.
- `HotelRoom` - room data with capacity, count, price, availability, and images.
- `BookingRequest` - hotel room reservation with date range, guest count, total price, and status.
- `SavedPaymentCard` - saved card metadata and local token.
- `TaxiService` - taxi company data with city, phone, description, image, and car classes.
- `TaxiCarClass` - taxi class and price per kilometer.
- `TaxiBooking` - taxi reservation with coordinates, route data, total price, and status.

## API Overview

| Area | Endpoints | Purpose |
| --- | --- | --- |
| Auth | `/api/auth/*` | Registration, login, refresh, logout, current user profile |
| Admins | `/api/admins/*` | Admin creation, user blocking, account management |
| Hotels | `/api/hotels/*` | Hotel listing and management |
| Hotel Rooms | `/api/hotel-rooms/*` | Room listing and management |
| Hotel Images | `/api/hotel-images` | Hotel image upload |
| Room Images | `/api/room-images` | Room image upload |
| Hotel Bookings | `/api/booking-requests/*` | Hotel booking creation, payment, cancellation, history |
| Payment Cards | `/api/payment-cards/*` | Saved card list, creation, deletion |
| Taxi Services | `/api/taxi-services/*` | Taxi service listing and management |
| Taxi Routes | `/api/taxi-routes/preview` | Google Routes preview for taxi bookings |
| Taxi Bookings | `/api/taxi-bookings/*` | Taxi booking creation, payment, cancellation, history |
| Health | `/health`, `/health/db` | API and database health checks |

Swagger UI is available in development mode through the backend launch profile.

## Routing & Deep Links

The frontend keeps meaningful navigation state in the URL so pages can be refreshed or shared.

Examples:

```text
/hotels?city=Baku&checkIn=2026-09-05&checkOut=2026-09-06
/hotels/3?roomId=12&checkIn=2026-09-05&checkOut=2026-09-06
/taxi?serviceId=2&class=Comfort
/auth?mode=login
```

Invalid hotel date ranges from query parameters are normalized before use, so the application does not search or book with unsafe date state.

## Getting Started

### Prerequisites

- .NET 8 SDK
- Node.js and npm
- SQL Server or Azure SQL compatible database
- Google Maps API key for browser maps
- Google Routes API key for backend taxi route calculation

### Clone

```bash
git clone https://github.com/CabirSultanov/TravelHub.git
cd TravelHub
```

### Backend Configuration

The backend reads configuration from `appsettings.json`, `appsettings.Development.json`, environment variables, and .NET user secrets. Keep real values outside Git.

Set local secrets with placeholders replaced by your own values:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-sql-server-connection-string" --project TravelHub.Api
dotnet user-secrets set "Jwt:Key" "your-jwt-key-at-least-32-characters" --project TravelHub.Api
dotnet user-secrets set "GoogleMaps:ApiKey" "your-backend-google-maps-key" --project TravelHub.Api
```

Optional super admin seed configuration:

```bash
dotnet user-secrets set "SeedSuperAdmin:Name" "Super Admin" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Email" "admin@gmail.com" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:PhoneNumber" "+994501234567" --project TravelHub.Api
dotnet user-secrets set "SeedSuperAdmin:Password" "your-local-super-admin-password" --project TravelHub.Api
```

### Frontend Configuration

Create `TravelHub.Client/.env` from the example file:

```env
VITE_GOOGLE_MAPS_API_KEY=your_browser_key_with_maps_javascript_and_geocoding
```

Do not commit `.env` or real API keys.

### Database

The API applies Entity Framework Core migrations during startup. You can also apply them manually if the EF CLI is installed:

```bash
dotnet ef database update --project TravelHub.Api
```

### Running the Application

Start the backend:

```bash
dotnet run --project TravelHub.Api
```

The development backend profile uses:

```text
http://localhost:5207
```

Start the frontend:

```bash
cd TravelHub.Client
npm install
npm run dev
```

The Vite dev server runs on:

```text
http://localhost:5173
```

The frontend development server proxies `/api`, `/health`, and `/images` requests to the backend.

## Testing

Run backend tests:

```bash
dotnet test TravelHub.Api.Tests/TravelHub.Api.Tests.csproj
```

Run frontend tests:

```bash
cd TravelHub.Client
npm test
```

Frontend production build:

```bash
cd TravelHub.Client
npm run build
```

## Continuous Integration

The repository includes a GitHub Actions workflow in `.github/workflows/ci.yml`. It runs on pull requests and on pushes to `main`.

The workflow:

- restores, builds, and tests the .NET backend test project;
- installs frontend dependencies with `npm ci`;
- builds the React client;
- runs frontend unit tests.

Frontend CI build expects this GitHub secret:

```text
VITE_GOOGLE_MAPS_API_KEY
```

## Secrets & Configuration Notes

Never commit real secrets to the repository.

Keep these values in user secrets, environment variables, GitHub Actions secrets, or local ignored files:

- `ConnectionStrings:DefaultConnection`
- `Jwt:Key`
- `GoogleMaps:ApiKey`
- `SeedSuperAdmin:Password`
- `VITE_GOOGLE_MAPS_API_KEY`
- database usernames and passwords

The committed `.env.example` file contains only a placeholder.

## Author

Cabir Sultanov

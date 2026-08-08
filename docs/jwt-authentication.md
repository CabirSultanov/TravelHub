# TravelHub JWT authentication

TravelHub uses a short-lived JWT access token together with a rotating refresh
token:

- Access token: 15 minutes by default. It is kept in frontend memory and sent
  as Authorization: Bearer ...
- Refresh token: 7 days by default. It is a cryptographically random opaque
  value stored only in an HttpOnly cookie. The database stores only its
  SHA-256 hash.
- Refresh rotation: a successful refresh revokes the old token, records the
  replacement hash, and issues a new cookie. The old token cannot be reused.

Configure the signing key locally with User Secrets:

    dotnet user-secrets set "Jwt:Key" "<your-development-secret>" --project TravelHub.Api

The key must be at least 32 characters. Issuer and audience are safe to keep
in appsettings.json, but can also be configured as secrets:

    dotnet user-secrets set "Jwt:Issuer" "TravelHub" --project TravelHub.Api
    dotnet user-secrets set "Jwt:Audience" "TravelHub.Client" --project TravelHub.Api

Production should provide Jwt:Key through environment configuration or a
secret manager. Do not commit a real signing key.

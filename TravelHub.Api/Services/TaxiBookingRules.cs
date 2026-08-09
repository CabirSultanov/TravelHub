namespace TravelHub.Api.Services;

public static class TaxiBookingRules
{
    private const decimal WebMercatorMaxLatitude = 85.05112878m;

    public static bool IsLatitude(decimal value) => value is >= -90 and <= 90;

    public static bool IsLongitude(decimal value) => value is >= -180 and <= 180;

    public static bool IsSameLocation(
        decimal pickupLatitude,
        decimal pickupLongitude,
        decimal dropoffLatitude,
        decimal dropoffLongitude) =>
        pickupLatitude == dropoffLatitude && pickupLongitude == dropoffLongitude;

    public static (decimal X, decimal Y) ToLegacyMapPoint(decimal latitude, decimal longitude)
    {
        var normalizedLatitude = Math.Clamp(latitude, -WebMercatorMaxLatitude, WebMercatorMaxLatitude);
        var x = Math.Clamp(((longitude + 180m) / 360m) * 100m, 0m, 100m);
        var y = Math.Clamp(((WebMercatorMaxLatitude - normalizedLatitude) / (WebMercatorMaxLatitude * 2m)) * 100m, 0m, 100m);

        return (
            Math.Round(x, 2, MidpointRounding.AwayFromZero),
            Math.Round(y, 2, MidpointRounding.AwayFromZero));
    }

    public static decimal RoundDistanceKm(decimal distanceKm) =>
        Math.Round(distanceKm, 2, MidpointRounding.AwayFromZero);

    public static decimal CalculateTotalPrice(decimal distanceKm, decimal pricePerKm) =>
        Math.Round(distanceKm * pricePerKm, 2, MidpointRounding.AwayFromZero);
}

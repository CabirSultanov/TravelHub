namespace TravelHub.Api.Services;

public static class TaxiBookingRules
{
    public static bool IsCoordinate(decimal value) => value is >= 0 and <= 100;

    public static bool IsSamePoint(decimal pickupX, decimal pickupY, decimal dropoffX, decimal dropoffY) =>
        pickupX == dropoffX && pickupY == dropoffY;

    public static decimal CalculateDistanceKm(decimal pickupX, decimal pickupY, decimal dropoffX, decimal dropoffY)
    {
        var x = (double)(dropoffX - pickupX);
        var y = (double)(dropoffY - pickupY);
        return Math.Round((decimal)Math.Sqrt(x * x + y * y), 2, MidpointRounding.AwayFromZero);
    }

    public static decimal CalculateTotalPrice(decimal distanceKm, decimal pricePerKm) =>
        Math.Round(distanceKm * pricePerKm, 2, MidpointRounding.AwayFromZero);
}

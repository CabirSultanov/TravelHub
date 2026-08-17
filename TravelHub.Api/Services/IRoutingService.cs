namespace TravelHub.Api.Services;

public record TaxiRouteResult(decimal DistanceKm, int DurationSeconds, string EncodedPolyline);

public interface IRoutingService
{
    Task<TaxiRouteResult> GetRouteAsync(
        decimal pickupLatitude,
        decimal pickupLongitude,
        decimal dropoffLatitude,
        decimal dropoffLongitude,
        CancellationToken cancellationToken);
}

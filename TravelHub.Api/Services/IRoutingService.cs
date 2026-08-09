namespace TravelHub.Api.Services;

public interface IRoutingService
{
    Task<decimal> GetDrivingDistanceKmAsync(
        decimal pickupLatitude,
        decimal pickupLongitude,
        decimal dropoffLatitude,
        decimal dropoffLongitude,
        CancellationToken cancellationToken);
}

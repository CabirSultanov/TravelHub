using System.Globalization;
using System.Text.Json;

namespace TravelHub.Api.Services;

public class OsrmRoutingService(HttpClient httpClient) : IRoutingService
{
    public async Task<decimal> GetDrivingDistanceKmAsync(
        decimal pickupLatitude,
        decimal pickupLongitude,
        decimal dropoffLatitude,
        decimal dropoffLongitude,
        CancellationToken cancellationToken)
    {
        var routeUrl =
            $"route/v1/driving/{ToInvariant(pickupLongitude)},{ToInvariant(pickupLatitude)};{ToInvariant(dropoffLongitude)},{ToInvariant(dropoffLatitude)}?overview=false";

        try
        {
            using var response = await httpClient.GetAsync(routeUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new RoutingUnavailableException("OSRM route request failed.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;

            if (root.TryGetProperty("code", out var code) && code.GetString() != "Ok")
            {
                throw new RoutingUnavailableException("OSRM returned no route.");
            }

            if (!root.TryGetProperty("routes", out var routes) ||
                routes.ValueKind != JsonValueKind.Array ||
                routes.GetArrayLength() == 0 ||
                !routes[0].TryGetProperty("distance", out var distanceElement) ||
                !distanceElement.TryGetDecimal(out var distanceMeters) ||
                distanceMeters <= 0)
            {
                throw new RoutingUnavailableException("OSRM returned no usable route distance.");
            }

            return TaxiBookingRules.RoundDistanceKm(distanceMeters / 1000m);
        }
        catch (RoutingUnavailableException)
        {
            throw;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OperationCanceledException)
        {
            throw new RoutingUnavailableException("Unable to calculate taxi route.", ex);
        }
    }

    private static string ToInvariant(decimal value) => value.ToString(CultureInfo.InvariantCulture);
}

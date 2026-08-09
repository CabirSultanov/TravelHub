using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace TravelHub.Api.Services;

public class GoogleRoutesService(
    HttpClient httpClient,
    IOptions<GoogleMapsOptions> options,
    ILogger<GoogleRoutesService> logger) : IRoutingService
{
    private const string FieldMask = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";

    public async Task<TaxiRouteResult> GetRouteAsync(
        decimal pickupLatitude,
        decimal pickupLongitude,
        decimal dropoffLatitude,
        decimal dropoffLongitude,
        CancellationToken cancellationToken)
    {
        var apiKey = options.Value.ApiKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new RoutingUnavailableException("Google Maps API key is not configured.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "directions/v2:computeRoutes")
        {
            Content = JsonContent.Create(new
            {
                origin = new
                {
                    location = new
                    {
                        latLng = new
                        {
                            latitude = pickupLatitude,
                            longitude = pickupLongitude
                        }
                    }
                },
                destination = new
                {
                    location = new
                    {
                        latLng = new
                        {
                            latitude = dropoffLatitude,
                            longitude = dropoffLongitude
                        }
                    }
                },
                travelMode = "DRIVE",
                polylineQuality = "OVERVIEW",
                polylineEncoding = "ENCODED_POLYLINE"
            })
        };
        request.Headers.Add("X-Goog-Api-Key", apiKey);
        request.Headers.Add("X-Goog-FieldMask", FieldMask);

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Google Routes request failed with status {StatusCode}.", response.StatusCode);
                throw new RoutingUnavailableException("Google Routes request failed.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            return ParseRoute(document.RootElement);
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

    private static TaxiRouteResult ParseRoute(JsonElement root)
    {
        if (!root.TryGetProperty("routes", out var routes) ||
            routes.ValueKind != JsonValueKind.Array ||
            routes.GetArrayLength() == 0)
        {
            throw new RoutingUnavailableException("Google Routes returned no route.");
        }

        var route = routes[0];

        if (!route.TryGetProperty("distanceMeters", out var distanceElement) ||
            !distanceElement.TryGetDecimal(out var distanceMeters) ||
            distanceMeters <= 0)
        {
            throw new RoutingUnavailableException("Google Routes returned no usable route distance.");
        }

        if (!route.TryGetProperty("duration", out var durationElement) ||
            !TryParseDurationSeconds(durationElement.GetString(), out var durationSeconds))
        {
            throw new RoutingUnavailableException("Google Routes returned no usable route duration.");
        }

        if (!route.TryGetProperty("polyline", out var polyline) ||
            !polyline.TryGetProperty("encodedPolyline", out var encodedPolylineElement))
        {
            throw new RoutingUnavailableException("Google Routes returned no route polyline.");
        }

        var encodedPolyline = encodedPolylineElement.GetString();

        if (string.IsNullOrWhiteSpace(encodedPolyline))
        {
            throw new RoutingUnavailableException("Google Routes returned an empty route polyline.");
        }

        return new TaxiRouteResult(
            TaxiBookingRules.RoundDistanceKm(distanceMeters / 1000m),
            durationSeconds,
            encodedPolyline);
    }

    private static bool TryParseDurationSeconds(string? duration, out int seconds)
    {
        seconds = 0;

        if (string.IsNullOrWhiteSpace(duration) || !duration.EndsWith('s'))
        {
            return false;
        }

        if (!decimal.TryParse(duration[..^1], NumberStyles.Number, CultureInfo.InvariantCulture, out var secondsValue) ||
            secondsValue < 0)
        {
            return false;
        }

        seconds = (int)Math.Ceiling(secondsValue);
        return true;
    }
}

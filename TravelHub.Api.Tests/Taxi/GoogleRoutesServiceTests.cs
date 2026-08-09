using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class GoogleRoutesServiceTests
{
    [Fact]
    public async Task GetRouteAsync_UsesGoogleRoutesDistanceDurationAndPolyline()
    {
        HttpRequestMessage? capturedRequest = null;
        var service = new GoogleRoutesService(
            new HttpClient(new StubHttpMessageHandler(request =>
            {
                capturedRequest = request;
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        """{"routes":[{"distanceMeters":7354,"duration":"820s","polyline":{"encodedPolyline":"abc123"}}]}""")
                };
            }))
            {
                BaseAddress = new Uri("https://routes.googleapis.com/")
            },
            Options.Create(new GoogleMapsOptions { ApiKey = "test-key" }),
            NullLogger<GoogleRoutesService>.Instance);

        var route = await service.GetRouteAsync(40.4093m, 49.8671m, 40.3953m, 49.8822m, CancellationToken.None);

        Assert.Equal(7.35m, route.DistanceKm);
        Assert.Equal(820, route.DurationSeconds);
        Assert.Equal("abc123", route.EncodedPolyline);
        Assert.Equal(HttpMethod.Post, capturedRequest?.Method);
        Assert.Equal("https://routes.googleapis.com/directions/v2:computeRoutes", capturedRequest?.RequestUri?.ToString());
        Assert.NotNull(capturedRequest);
        Assert.True(capturedRequest.Headers.TryGetValues("X-Goog-Api-Key", out var apiKeys));
        Assert.Equal("test-key", Assert.Single(apiKeys));
        Assert.True(capturedRequest.Headers.TryGetValues("X-Goog-FieldMask", out var fieldMasks));
        Assert.Equal("routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline", Assert.Single(fieldMasks));
    }

    [Fact]
    public async Task GetRouteAsync_WhenGoogleReturnsNoRoute_ThrowsRoutingUnavailable()
    {
        var service = new GoogleRoutesService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"routes":[]}""")
            }))
            {
                BaseAddress = new Uri("https://routes.googleapis.com/")
            },
            Options.Create(new GoogleMapsOptions { ApiKey = "test-key" }),
            NullLogger<GoogleRoutesService>.Instance);

        await Assert.ThrowsAsync<RoutingUnavailableException>(() =>
            service.GetRouteAsync(40.4093m, 49.8671m, 40.3953m, 49.8822m, CancellationToken.None));
    }

    [Fact]
    public async Task GetRouteAsync_WhenApiKeyIsMissing_ThrowsRoutingUnavailable()
    {
        var service = new GoogleRoutesService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            Options.Create(new GoogleMapsOptions()),
            NullLogger<GoogleRoutesService>.Instance);

        await Assert.ThrowsAsync<RoutingUnavailableException>(() =>
            service.GetRouteAsync(40.4093m, 49.8671m, 40.3953m, 49.8822m, CancellationToken.None));
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(handler(request));
    }
}

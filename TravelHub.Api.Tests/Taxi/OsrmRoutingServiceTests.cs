using System.Net;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class OsrmRoutingServiceTests
{
    [Fact]
    public async Task GetDrivingDistanceKmAsync_UsesOsrmRouteDistance()
    {
        var service = new OsrmRoutingService(new HttpClient(new StubHttpMessageHandler(
            """{"code":"Ok","routes":[{"distance":7354}]}"""))
        {
            BaseAddress = new Uri("https://router.project-osrm.org/")
        });

        var distanceKm = await service.GetDrivingDistanceKmAsync(40.4093m, 49.8671m, 40.3953m, 49.8822m, CancellationToken.None);

        Assert.Equal(7.35m, distanceKm);
    }

    [Fact]
    public async Task GetDrivingDistanceKmAsync_WhenOsrmFails_ThrowsRoutingUnavailable()
    {
        var service = new OsrmRoutingService(new HttpClient(new StubHttpMessageHandler("""{"code":"NoRoute","routes":[]}"""))
        {
            BaseAddress = new Uri("https://router.project-osrm.org/")
        });

        await Assert.ThrowsAsync<RoutingUnavailableException>(() =>
            service.GetDrivingDistanceKmAsync(40.4093m, 49.8671m, 40.3953m, 49.8822m, CancellationToken.None));
    }

    private sealed class StubHttpMessageHandler(string content) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(content)
            });
        }
    }
}

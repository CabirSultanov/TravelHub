using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.Controllers;
using TravelHub.Api.DTO;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiRoutesControllerTests
{
    [Fact]
    public async Task PreviewRoute_ReturnsRouteFromRoutingService()
    {
        var controller = new TaxiRoutesController(new FakeRoutingService(new TaxiRouteResult(7.35m, 820, "encoded")));

        var result = await controller.PreviewRoute(CreateDto(), CancellationToken.None);

        var response = Assert.IsType<TaxiRoutePreviewResponseDto>(result.Value);
        Assert.Equal(7.35m, response.DistanceKm);
        Assert.Equal(820, response.DurationSeconds);
        Assert.Equal("encoded", response.EncodedPolyline);
    }

    [Fact]
    public async Task PreviewRoute_WhenCoordinatesAreInvalid_ReturnsBadRequest()
    {
        var dto = CreateDto();
        dto.PickupLatitude = 91m;
        var controller = new TaxiRoutesController(new FakeRoutingService(new TaxiRouteResult(7.35m, 820, "encoded")));

        var result = await controller.PreviewRoute(dto, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task PreviewRoute_WhenRoutingFails_ReturnsServiceUnavailable()
    {
        var controller = new TaxiRoutesController(new FailingRoutingService());

        var result = await controller.PreviewRoute(CreateDto(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status.StatusCode);
    }

    private static TaxiRoutePreviewRequestDto CreateDto() => new()
    {
        PickupLatitude = 40.4093m,
        PickupLongitude = 49.8671m,
        DropoffLatitude = 40.3953m,
        DropoffLongitude = 49.8822m
    };

    private sealed class FakeRoutingService(TaxiRouteResult route) : IRoutingService
    {
        public Task<TaxiRouteResult> GetRouteAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) => Task.FromResult(route);
    }

    private sealed class FailingRoutingService : IRoutingService
    {
        public Task<TaxiRouteResult> GetRouteAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) =>
            throw new RoutingUnavailableException("No route");
    }
}

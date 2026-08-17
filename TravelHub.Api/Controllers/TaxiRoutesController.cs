using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.DTO;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/taxi-routes")]
public class TaxiRoutesController(IRoutingService routingService) : ControllerBase
{
    [HttpPost("preview")]
    public async Task<ActionResult<TaxiRoutePreviewResponseDto>> PreviewRoute(
        TaxiRoutePreviewRequestDto routeDto,
        CancellationToken cancellationToken)
    {
        if (!TaxiBookingRules.IsLatitude(routeDto.PickupLatitude) ||
            !TaxiBookingRules.IsLongitude(routeDto.PickupLongitude) ||
            !TaxiBookingRules.IsLatitude(routeDto.DropoffLatitude) ||
            !TaxiBookingRules.IsLongitude(routeDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff latitude/longitude values are invalid.");
        }

        if (TaxiBookingRules.IsSameLocation(
            routeDto.PickupLatitude,
            routeDto.PickupLongitude,
            routeDto.DropoffLatitude,
            routeDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff points must be different.");
        }

        try
        {
            var route = await routingService.GetRouteAsync(
                routeDto.PickupLatitude,
                routeDto.PickupLongitude,
                routeDto.DropoffLatitude,
                routeDto.DropoffLongitude,
                cancellationToken);

            return new TaxiRoutePreviewResponseDto
            {
                DistanceKm = route.DistanceKm,
                DurationSeconds = route.DurationSeconds,
                EncodedPolyline = route.EncodedPolyline
            };
        }
        catch (RoutingUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Unable to calculate taxi route. Please try again.");
        }
    }
}

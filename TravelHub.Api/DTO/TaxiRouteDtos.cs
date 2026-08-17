using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class TaxiRoutePreviewRequestDto
{
    [Range(-90, 90)]
    public decimal PickupLatitude { get; set; }

    [Range(-180, 180)]
    public decimal PickupLongitude { get; set; }

    [Range(-90, 90)]
    public decimal DropoffLatitude { get; set; }

    [Range(-180, 180)]
    public decimal DropoffLongitude { get; set; }
}

public class TaxiRoutePreviewResponseDto
{
    public decimal DistanceKm { get; set; }

    public int DurationSeconds { get; set; }

    public string EncodedPolyline { get; set; } = string.Empty;
}

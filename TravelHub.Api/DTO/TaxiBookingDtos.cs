using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class TaxiBookingCreateDto
{
    public int TaxiServiceId { get; set; }

    [Required]
    [MaxLength(100)]
    public string CarClassName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string CustomerName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string PickupAddress { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string DropoffAddress { get; set; } = string.Empty;

    [Range(-90, 90)]
    public decimal PickupLatitude { get; set; }

    [Range(-180, 180)]
    public decimal PickupLongitude { get; set; }

    [Range(-90, 90)]
    public decimal DropoffLatitude { get; set; }

    [Range(-180, 180)]
    public decimal DropoffLongitude { get; set; }

    [Required]
    public BookingPaymentDto Payment { get; set; } = new();
}

public class TaxiBookingResponseDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int TaxiServiceId { get; set; }

    public string TaxiServiceName { get; set; } = string.Empty;

    public string CarClassName { get; set; } = string.Empty;

    public string CustomerName { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PickupAddress { get; set; } = string.Empty;

    public string DropoffAddress { get; set; } = string.Empty;

    public decimal PickupX { get; set; }

    public decimal PickupY { get; set; }

    public decimal DropoffX { get; set; }

    public decimal DropoffY { get; set; }

    public decimal PickupLatitude { get; set; }

    public decimal PickupLongitude { get; set; }

    public decimal DropoffLatitude { get; set; }

    public decimal DropoffLongitude { get; set; }

    public decimal DistanceKm { get; set; }

    public decimal PricePerKm { get; set; }

    public decimal TotalPrice { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime? PaidAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? SavedCardLast4 { get; set; }

    public int? DriverId { get; set; }

    public string? DriverName { get; set; }

    public string? DriverPhoneNumber { get; set; }

    public DateTime? AcceptedAt { get; set; }

    public DateTime? ArrivedAt { get; set; }

    public DateTime? CompletedAt { get; set; }
}

public class TaxiDriverRideResponseDto
{
    public int Id { get; set; }
    public string TaxiServiceName { get; set; } = string.Empty;
    public string CarClassName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string PickupAddress { get; set; } = string.Empty;
    public string DropoffAddress { get; set; } = string.Empty;
    public decimal DistanceKm { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? AcceptedAt { get; set; }
    public DateTime? ArrivedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

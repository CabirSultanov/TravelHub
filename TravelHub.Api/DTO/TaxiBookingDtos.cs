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

    [Range(0, 100)]
    public decimal PickupX { get; set; }

    [Range(0, 100)]
    public decimal PickupY { get; set; }

    [Range(0, 100)]
    public decimal DropoffX { get; set; }

    [Range(0, 100)]
    public decimal DropoffY { get; set; }
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

    public decimal DistanceKm { get; set; }

    public decimal PricePerKm { get; set; }

    public decimal TotalPrice { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime? PaidAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? SavedCardLast4 { get; set; }
}

using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TravelHub.Api.Models;

public class TaxiBooking
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public AppUser User { get; set; } = null!;

    public int TaxiServiceId { get; set; }

    [Required]
    [MaxLength(150)]
    public string TaxiServiceName { get; set; } = string.Empty;

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
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string PickupAddress { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string DropoffAddress { get; set; } = string.Empty;

    [Precision(18, 2)]
    public decimal PickupX { get; set; }

    [Precision(18, 2)]
    public decimal PickupY { get; set; }

    [Precision(18, 2)]
    public decimal DropoffX { get; set; }

    [Precision(18, 2)]
    public decimal DropoffY { get; set; }

    [Precision(9, 6)]
    public decimal PickupLatitude { get; set; }

    [Precision(9, 6)]
    public decimal PickupLongitude { get; set; }

    [Precision(9, 6)]
    public decimal DropoffLatitude { get; set; }

    [Precision(9, 6)]
    public decimal DropoffLongitude { get; set; }

    [Precision(18, 2)]
    public decimal DistanceKm { get; set; }

    [Precision(18, 2)]
    public decimal PricePerKm { get; set; }

    [Precision(18, 2)]
    public decimal TotalPrice { get; set; }

    public TaxiBookingStatus Status { get; set; } = TaxiBookingStatus.AwaitingDriver;

    public int? DriverId { get; set; }

    public AppUser? Driver { get; set; }

    public DateTime? AcceptedAt { get; set; }

    public DateTime? ArrivedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime? PaidAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    [MaxLength(4)]
    public string? SavedCardLast4 { get; set; }

    [MaxLength(64)]
    public string? PaymentToken { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<TaxiBookingDriverDecline> DriverDeclines { get; set; } = new List<TaxiBookingDriverDecline>();
}

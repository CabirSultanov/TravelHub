using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TravelHub.Api.Models;

public class BookingRequest
{
    public int Id { get; set; }

    public int HotelRoomId { get; set; }

    public HotelRoom HotelRoom { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string CustomerName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    public DateOnly CheckInDate { get; set; }

    public DateOnly CheckOutDate { get; set; }

    public int GuestsCount { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.PendingPayment;

    [Precision(18, 2)]
    public decimal TotalPrice { get; set; }
}

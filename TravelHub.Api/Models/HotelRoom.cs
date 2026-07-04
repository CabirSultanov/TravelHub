using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TravelHub.Api.Models;

public class HotelRoom
{
    public int Id { get; set; }

    public int HotelId { get; set; }

    public Hotel Hotel { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string RoomType { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TotalRooms { get; set; } = 1;

    [Precision(18, 2)]
    public decimal PricePerNight { get; set; }

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    public bool IsAvailable { get; set; } = true;
}

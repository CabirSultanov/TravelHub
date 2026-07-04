using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class HotelRoomCreateDto
{
    public int HotelId { get; set; }

    [Required]
    [MaxLength(100)]
    public string RoomType { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TotalRooms { get; set; } = 1;

    public decimal PricePerNight { get; set; }

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    public bool IsAvailable { get; set; } = true;
}

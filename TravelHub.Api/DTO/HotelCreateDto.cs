using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class HotelCreateDto
{
    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    public List<string> ImageUrls { get; set; } = new();

    public List<HotelCreateRoomDto> Rooms { get; set; } = new();
}

public class HotelCreateRoomDto
{
    [Required]
    [MaxLength(100)]
    public string RoomType { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TotalRooms { get; set; } = 1;

    public decimal PricePerNight { get; set; }

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    public List<string> ImageUrls { get; set; } = new();

    public bool IsAvailable { get; set; } = true;
}

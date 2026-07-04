namespace TravelHub.Api.DTO;

public class HotelRoomResponseDto
{
    public int Id { get; set; }

    public int HotelId { get; set; }

    public string RoomType { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TotalRooms { get; set; }

    public decimal PricePerNight { get; set; }

    public string Description { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public bool IsAvailable { get; set; }
}

namespace TravelHub.Api.DTO;

public class HotelResponseDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string City { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public List<string> ImageUrls { get; set; } = new();

    public int RoomTypesCount { get; set; }

    public int TotalRoomsCount { get; set; }

    public int TotalGuestPlaces { get; set; }

    public double? AverageRating { get; set; }

    public int ReviewCount { get; set; }
}

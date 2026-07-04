namespace TravelHub.Api.DTO;

public class BookingRequestResponseDto
{
    public int Id { get; set; }

    public int HotelRoomId { get; set; }

    public int HotelId { get; set; }

    public string RoomType { get; set; } = string.Empty;

    public string CustomerName { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public DateOnly CheckInDate { get; set; }

    public DateOnly CheckOutDate { get; set; }

    public int GuestsCount { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime? PaidAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? SavedCardLast4 { get; set; }

    public decimal TotalPrice { get; set; }
}

namespace TravelHub.Api.DTO;

public class OwnerBookingDto
{
    public int Id { get; set; }
    public int HotelId { get; set; }
    public int HotelRoomId { get; set; }
    public string HotelName { get; set; } = string.Empty;
    public string RoomType { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public decimal TotalPrice { get; set; }
}

public class OwnerOverviewDto
{
    public DateOnly Today { get; set; }
    public int ArrivalsToday { get; set; }
    public int DeparturesToday { get; set; }
    public int AwaitingPayment { get; set; }
    public List<OwnerBookingDto> UpcomingArrivals { get; set; } = [];
}

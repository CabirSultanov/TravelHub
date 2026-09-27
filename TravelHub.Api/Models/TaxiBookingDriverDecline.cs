namespace TravelHub.Api.Models;

public class TaxiBookingDriverDecline
{
    public int TaxiBookingId { get; set; }

    public TaxiBooking TaxiBooking { get; set; } = null!;

    public int DriverId { get; set; }

    public AppUser Driver { get; set; } = null!;

    public DateTime DeclinedAt { get; set; } = DateTime.UtcNow;
}

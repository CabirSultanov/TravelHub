namespace TravelHub.Api.Services;

public static class HotelBookingRules
{
    private static readonly TimeZoneInfo BakuTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Baku");

    public const string InvalidDateRangeMessage = "Check-out date must be after check-in date.";

    public static DateOnly TodayInBaku(DateTimeOffset utcNow) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(utcNow, BakuTimeZone).DateTime);

    public static int MaximumConcurrentBookings(IEnumerable<(DateOnly CheckIn, DateOnly CheckOut)> stays)
    {
        var occupancy = 0;
        var maximum = 0;
        var changes = stays.SelectMany(stay => new[] { (Date: stay.CheckIn, Change: 1), (Date: stay.CheckOut, Change: -1) });
        foreach (var change in changes.OrderBy(change => change.Date).ThenBy(change => change.Change))
        {
            occupancy += change.Change;
            maximum = Math.Max(maximum, occupancy);
        }
        return maximum;
    }

    public static string? ValidateDateRange(DateOnly checkInDate, DateOnly checkOutDate) =>
        checkOutDate > checkInDate ? null : InvalidDateRangeMessage;

    public static int CalculateNights(DateOnly checkInDate, DateOnly checkOutDate) =>
        checkOutDate.DayNumber - checkInDate.DayNumber;

    public static decimal CalculateTotalPrice(decimal pricePerNight, DateOnly checkInDate, DateOnly checkOutDate) =>
        CalculateNights(checkInDate, checkOutDate) * pricePerNight;

    public static bool HasRoomAvailability(int activeBookingCount, int totalRooms) =>
        activeBookingCount < totalRooms;
}

namespace TravelHub.Api.Services;

public static class HotelBookingRules
{
    public const string InvalidDateRangeMessage = "CheckOutDate must be after CheckInDate.";

    public static string? ValidateDateRange(DateOnly checkInDate, DateOnly checkOutDate) =>
        checkOutDate > checkInDate ? null : InvalidDateRangeMessage;

    public static int CalculateNights(DateOnly checkInDate, DateOnly checkOutDate) =>
        checkOutDate.DayNumber - checkInDate.DayNumber;

    public static decimal CalculateTotalPrice(decimal pricePerNight, DateOnly checkInDate, DateOnly checkOutDate) =>
        CalculateNights(checkInDate, checkOutDate) * pricePerNight;

    public static bool HasRoomAvailability(int activeBookingCount, int totalRooms) =>
        activeBookingCount < totalRooms;
}

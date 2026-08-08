using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Booking;

public class HotelBookingRulesTests
{
    [Fact]
    public void ValidateDateRange_WhenCheckoutIsAfterCheckin_ReturnsValid()
    {
        var result = HotelBookingRules.ValidateDateRange(
            new DateOnly(2026, 8, 10),
            new DateOnly(2026, 8, 13));

        Assert.Null(result);
    }

    [Theory]
    [InlineData(2026, 8, 13, 2026, 8, 13)]
    [InlineData(2026, 8, 13, 2026, 8, 10)]
    public void ValidateDateRange_WhenCheckoutIsNotAfterCheckin_ReturnsInvalid(
        int checkInYear,
        int checkInMonth,
        int checkInDay,
        int checkOutYear,
        int checkOutMonth,
        int checkOutDay)
    {
        var result = HotelBookingRules.ValidateDateRange(
            new DateOnly(checkInYear, checkInMonth, checkInDay),
            new DateOnly(checkOutYear, checkOutMonth, checkOutDay));

        Assert.Equal("CheckOutDate must be after CheckInDate.", result);
    }

    [Fact]
    public void CalculateNights_WithThreeNightStay_ReturnsThree()
    {
        var nights = HotelBookingRules.CalculateNights(
            new DateOnly(2026, 8, 10),
            new DateOnly(2026, 8, 13));

        Assert.Equal(3, nights);
    }

    [Fact]
    public void CalculateTotalPrice_WithThreeNights_ReturnsExpectedPrice()
    {
        var totalPrice = HotelBookingRules.CalculateTotalPrice(
            125.50m,
            new DateOnly(2026, 8, 10),
            new DateOnly(2026, 8, 13));

        Assert.Equal(376.50m, totalPrice);
    }

    [Fact]
    public void HasRoomAvailability_WhenBookingCountReachesCapacity_ReturnsFalse()
    {
        Assert.False(HotelBookingRules.HasRoomAvailability(activeBookingCount: 2, totalRooms: 2));
        Assert.True(HotelBookingRules.HasRoomAvailability(activeBookingCount: 1, totalRooms: 2));
    }

    [Fact]
    public void NewBookingRequest_HasPendingPaymentStatus()
    {
        var booking = new BookingRequest();

        Assert.Equal(BookingStatus.PendingPayment, booking.Status);
    }
}

using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiBookingRulesTests
{
    [Fact]
    public void IsLatitude_WithBoundaries_ReturnsValid()
    {
        Assert.True(TaxiBookingRules.IsLatitude(-90m));
        Assert.True(TaxiBookingRules.IsLatitude(90m));
        Assert.False(TaxiBookingRules.IsLatitude(-90.01m));
        Assert.False(TaxiBookingRules.IsLatitude(90.01m));
    }

    [Fact]
    public void IsLongitude_WithBoundaries_ReturnsValid()
    {
        Assert.True(TaxiBookingRules.IsLongitude(-180m));
        Assert.True(TaxiBookingRules.IsLongitude(180m));
        Assert.False(TaxiBookingRules.IsLongitude(-180.01m));
        Assert.False(TaxiBookingRules.IsLongitude(180.01m));
    }

    [Fact]
    public void IsSameLocation_WhenCoordinatesDiffer_ReturnsFalse()
    {
        Assert.True(TaxiBookingRules.IsSameLocation(40.1m, 49.1m, 40.1m, 49.1m));
        Assert.False(TaxiBookingRules.IsSameLocation(40.1m, 49.1m, 40.2m, 49.1m));
    }

    [Fact]
    public void ToLegacyMapPoint_NormalizesGeographicCoordinates()
    {
        var point = TaxiBookingRules.ToLegacyMapPoint(0m, 0m);

        Assert.Equal(50m, point.X);
        Assert.Equal(50m, point.Y);
    }

    [Fact]
    public void CalculateTotalPrice_UsesPricePerKilometer()
    {
        var totalPrice = TaxiBookingRules.CalculateTotalPrice(12.34m, 2.5m);

        Assert.Equal(30.85m, totalPrice);
    }
}

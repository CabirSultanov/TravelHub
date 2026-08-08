using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiBookingRulesTests
{
    [Fact]
    public void IsCoordinate_WithMapBoundaries_ReturnsValid()
    {
        Assert.True(TaxiBookingRules.IsCoordinate(0m));
        Assert.True(TaxiBookingRules.IsCoordinate(100m));
        Assert.False(TaxiBookingRules.IsCoordinate(-0.01m));
        Assert.False(TaxiBookingRules.IsCoordinate(100.01m));
    }

    [Fact]
    public void IsSamePoint_WhenCoordinatesDiffer_ReturnsFalse()
    {
        Assert.True(TaxiBookingRules.IsSamePoint(10m, 20m, 10m, 20m));
        Assert.False(TaxiBookingRules.IsSamePoint(10m, 20m, 10m, 21m));
    }

    [Fact]
    public void CalculateDistanceKm_WithThreeFourTriangle_ReturnsFive()
    {
        var distance = TaxiBookingRules.CalculateDistanceKm(0m, 0m, 3m, 4m);

        Assert.Equal(5m, distance);
    }

    [Fact]
    public void CalculateDistanceKm_RoundsToTwoDecimalPlaces()
    {
        var distance = TaxiBookingRules.CalculateDistanceKm(0m, 0m, 1m, 1m);

        Assert.Equal(1.41m, distance);
    }

    [Fact]
    public void CalculateTotalPrice_UsesPricePerKilometer()
    {
        var totalPrice = TaxiBookingRules.CalculateTotalPrice(12.34m, 2.5m);

        Assert.Equal(30.85m, totalPrice);
    }
}

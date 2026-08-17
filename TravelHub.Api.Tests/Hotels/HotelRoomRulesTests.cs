using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Hotels;

public class HotelRoomRulesTests
{
    [Fact]
    public void ValidateRoom_WithValidData_ReturnsValid()
    {
        var result = HotelRoomRules.ValidateRoom("Deluxe", 2, 10, 150m);

        Assert.Null(result);
    }

    [Theory]
    [InlineData("", 2, 1, 100d, "RoomType is required.")]
    [InlineData("Deluxe", 0, 1, 100d, "Capacity must be greater than 0.")]
    [InlineData("Deluxe", 2, 0, 100d, "TotalRooms must be greater than 0.")]
    [InlineData("Deluxe", 2, 1, -1d, "PricePerNight cannot be negative.")]
    public void ValidateRoom_WhenInputIsInvalid_ReturnsExpectedError(
        string roomType,
        int capacity,
        int totalRooms,
        double pricePerNight,
        string expectedError)
    {
        var result = HotelRoomRules.ValidateRoom(roomType, capacity, totalRooms, (decimal)pricePerNight);

        Assert.Equal(expectedError, result);
    }

    [Fact]
    public void ValidateRoomSet_WithTwoTypesAndOneHundredPlaces_ReturnsValid()
    {
        var result = HotelRoomRules.ValidateRoomSet([
            new HotelRoomDraft("Standard", 2, 25),
            new HotelRoomDraft("Deluxe", 2, 25)
        ]);

        Assert.Null(result);
    }

    [Fact]
    public void ValidateRoomSet_WithDuplicateRoomTypes_ReturnsInvalid()
    {
        var result = HotelRoomRules.ValidateRoomSet([
            new HotelRoomDraft(" Standard ", 2, 50),
            new HotelRoomDraft("standard", 2, 50)
        ]);

        Assert.Equal("Hotel must have at least 2 room types.", result);
    }

    [Fact]
    public void ValidateRoomSet_WithLessThanOneHundredPlaces_ReturnsInvalid()
    {
        var result = HotelRoomRules.ValidateRoomSet([
            new HotelRoomDraft("Standard", 1, 50),
            new HotelRoomDraft("Deluxe", 1, 49)
        ]);

        Assert.Equal("Hotel rooms must fit at least 100 guests.", result);
    }

    [Fact]
    public void NormalizeImageUrls_TrimsAddsFallbackAndDeduplicates()
    {
        var urls = HotelRoomRules.NormalizeImageUrls(
            [" https://example.com/room ", "https://example.com/room", "https://example.com/second"],
            " https://example.com/fallback ",
            out var error);

        Assert.Null(error);
        Assert.Equal(
            [
                "https://example.com/room",
                "https://example.com/second",
                "https://example.com/fallback"
            ],
            urls);
    }

    [Fact]
    public void NormalizeImageUrls_WhenUrlIsNotHttp_ReturnsError()
    {
        var urls = HotelRoomRules.NormalizeImageUrls(
            ["file:///room.jpg"],
            null,
            out var error);

        Assert.Empty(urls);
        Assert.Equal("Image URLs must be valid http, https, or uploaded image URLs.", error);
    }

    [Fact]
    public void NormalizeImageUrls_AllowsUploadedImageUrls()
    {
        var urls = HotelRoomRules.NormalizeImageUrls(
            ["/images/rooms/room.jpg", "/images/hotel-covers/hotel.webp"],
            null,
            out var error);

        Assert.Null(error);
        Assert.Equal(["/images/rooms/room.jpg", "/images/hotel-covers/hotel.webp"], urls);
    }

    [Fact]
    public void FromJson_WhenJsonIsInvalid_UsesFallbackImage()
    {
        var urls = HotelRoomRules.FromJson(
            "not-json",
            " https://example.com/fallback ");

        Assert.Equal(["https://example.com/fallback"], urls);
    }
}

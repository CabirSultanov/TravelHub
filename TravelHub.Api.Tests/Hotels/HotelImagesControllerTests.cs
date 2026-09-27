using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Hotels;

public class HotelImagesControllerTests
{
    [Fact]
    public async Task CreateHotel_WithMultipleImages_SavesFirstAsLegacyImageAndReturnsAllImages()
    {
        await using var db = CreateDb();
        var controller = CreateAdminController(db);

        var result = await controller.CreateHotel(new HotelCreateDto
        {
            Name = "Baku Palace",
            City = "Baku",
            ImageUrls =
            [
                " https://example.com/hotel-a.jpg ",
                "https://example.com/hotel-a.jpg",
                "https://example.com/hotel-b.jpg"
            ],
            Rooms = ValidRooms()
        });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<HotelResponseDto>(created.Value);
        var hotel = await db.Hotels.SingleAsync();

        Assert.Equal("https://example.com/hotel-a.jpg", hotel.ImageUrl);
        Assert.Equal(["https://example.com/hotel-a.jpg", "https://example.com/hotel-b.jpg"], response.ImageUrls);
        Assert.Equal(response.ImageUrls, HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl));
    }

    [Fact]
    public async Task GetHotel_WithOnlyLegacyImageUrl_ReturnsImageUrlsFallback()
    {
        await using var db = CreateDb();
        db.Hotels.Add(new Hotel
        {
            Name = "Legacy Stay",
            City = "Baku",
            ImageUrl = "https://example.com/legacy.jpg",
            ImageUrlsJson = "[]"
        });
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotel(1);

        var response = Assert.IsType<HotelResponseDto>(result.Value);
        Assert.Equal(["https://example.com/legacy.jpg"], response.ImageUrls);
    }

    [Fact]
    public async Task UpdateHotel_WithMultipleImages_UpdatesLegacyAndJsonImages()
    {
        await using var db = CreateDb();
        db.Hotels.Add(new Hotel { Name = "Old", City = "Baku", ImageUrl = "https://example.com/old.jpg" });
        await db.SaveChangesAsync();
        var controller = CreateAdminController(db);

        var result = await controller.UpdateHotel(1, new HotelUpdateDto
        {
            Name = "New",
            City = "Baku",
            ImageUrls =
            [
                "https://example.com/new-a.jpg",
                "",
                "https://example.com/new-b.jpg"
            ]
        });

        Assert.IsType<NoContentResult>(result);
        var hotel = await db.Hotels.SingleAsync();
        Assert.Equal("https://example.com/new-a.jpg", hotel.ImageUrl);
        Assert.Equal(
            ["https://example.com/new-a.jpg", "https://example.com/new-b.jpg"],
            HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }

    private static HotelsController CreateAdminController(AppDbContext db)
    {
        var controller = new HotelsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, "1"), new Claim(ClaimTypes.Role, UserRoles.Admin)],
                    "TestAuth"))
            }
        };
        return controller;
    }

    private static List<HotelCreateRoomDto> ValidRooms() =>
    [
        new()
        {
            RoomType = "Standard",
            Capacity = 2,
            TotalRooms = 25,
            PricePerNight = 100
        },
        new()
        {
            RoomType = "Family",
            Capacity = 2,
            TotalRooms = 25,
            PricePerNight = 150
        }
    ];
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Booking;

public class BookingRequestsControllerTests
{
    [Fact]
    public async Task CreateBookingRequest_WhenCheckoutIsNotAfterCheckin_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        SeedHotelData(db);
        var controller = CreateController(db);

        var result = await controller.CreateBookingRequest(new BookingRequestCreateDto
        {
            HotelRoomId = 10,
            CustomerName = "Jane Doe",
            PhoneNumber = "+994 501234567",
            Email = "jane@example.com",
            CheckInDate = new DateOnly(2026, 9, 5),
            CheckOutDate = new DateOnly(2026, 8, 27)
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Check-out date must be after check-in date.", badRequest.Value);
        Assert.Empty(await db.BookingRequests.ToListAsync());
    }

    private static BookingRequestsController CreateController(AppDbContext db)
    {
        var controller = new BookingRequestsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, "1"),
                        new Claim(ClaimTypes.Role, UserRoles.User)
                    ],
                    "TestAuth"))
            }
        };
        return controller;
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static void SeedHotelData(AppDbContext db)
    {
        db.Users.Add(new AppUser
        {
            Id = 1,
            Name = "Jane Doe",
            Email = "jane@example.com",
            PasswordHash = "hash",
            PhoneNumber = "+994 501234567",
            Role = UserRoles.User
        });
        db.Hotels.Add(new Hotel
        {
            Id = 5,
            Name = "Baku Stay",
            City = "Baku",
            Description = "Central hotel"
        });
        db.HotelRooms.Add(new HotelRoom
        {
            Id = 10,
            HotelId = 5,
            RoomType = "Standard",
            Capacity = 2,
            TotalRooms = 5,
            PricePerNight = 120m,
            Description = "Standard room",
            IsAvailable = true
        });
        db.SaveChanges();
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Hotels;

public class HotelRoomBookingGuardsTests
{
    [Theory]
    [InlineData(BookingStatus.Paid)]
    [InlineData(BookingStatus.PendingPayment)]
    [InlineData(BookingStatus.Cancelled)]
    public async Task DeleteRoom_WithAnyHistoricalBooking_IsRejectedAndKeepsHistory(BookingStatus status)
    {
        await using var db = await CreateDb();
        var booking = Booking(1, -10, -5, status);
        db.BookingRequests.Add(booking);
        await db.SaveChangesAsync();

        var result = await Controller(db).DeleteHotelRoom(10);

        Assert.IsType<ConflictObjectResult>(result);
        Assert.NotNull(await db.HotelRooms.FindAsync(10));
        Assert.Equal(status, (await db.BookingRequests.SingleAsync()).Status);
    }

    [Fact]
    public async Task RoomReduction_CountsPendingAndCurrentOverlappingStays()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(Booking(1, -2, 2), Booking(2, 1, 3, BookingStatus.PendingPayment), Booking(3, 1, 2));
        await db.SaveChangesAsync();

        var result = await Controller(db).UpdateHotelRoom(10, Update(totalRooms: 2));

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("lower than 3", Assert.IsType<string>(conflict.Value));
        Assert.Equal(10, (await db.HotelRooms.FindAsync(10))!.TotalRooms);
    }

    [Fact]
    public async Task RoomReduction_AllowsPeakCountAndSameDayCheckout_IgnoresPastAndCancelled()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(Booking(1, -1, 1), Booking(2, 1, 3, BookingStatus.PendingPayment),
            Booking(3, 2, 3, BookingStatus.Cancelled), Booking(4, -2, 0));
        await db.SaveChangesAsync();

        Assert.IsType<NoContentResult>(await Controller(db).UpdateHotelRoom(10, Update(totalRooms: 1)));
        Assert.Equal(1, (await db.HotelRooms.FindAsync(10))!.TotalRooms);
        Assert.Equal(4, await db.BookingRequests.CountAsync());
    }

    [Theory]
    [InlineData(BookingStatus.Paid, -1)]
    [InlineData(BookingStatus.PendingPayment, 1)]
    public async Task CapacityReduction_CannotDisplaceSavedGuests(BookingStatus status, int checkIn)
    {
        await using var db = await CreateDb();
        db.BookingRequests.Add(Booking(1, checkIn, 3, status));
        await db.SaveChangesAsync();

        Assert.IsType<ConflictObjectResult>(await Controller(db).UpdateHotelRoom(10, Update(capacity: 3)));
        Assert.Equal(4, (await db.HotelRooms.FindAsync(10))!.Capacity);
    }

    [Fact]
    public async Task CapacityReduction_IgnoresPastAndCancelledBookings()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(Booking(1, -2, 0), Booking(2, 1, 3, BookingStatus.Cancelled));
        await db.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await Controller(db).UpdateHotelRoom(10, Update(capacity: 2)));
    }

    [Fact]
    public async Task ClosingRoomAndChangingPrice_PreservesBookingStatusAndOriginalPrice_AndPreventsNewBooking()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(Booking(1), Booking(2, status: BookingStatus.PendingPayment));
        await db.SaveChangesAsync();
        var update = Update();
        update.IsAvailable = false;
        update.PricePerNight = 999;

        Assert.IsType<NoContentResult>(await Controller(db).UpdateHotelRoom(10, update));
        var bookings = await db.BookingRequests.OrderBy(booking => booking.Id).ToListAsync();
        Assert.Equal(new[] { BookingStatus.Paid, BookingStatus.PendingPayment }, bookings.Select(booking => booking.Status));
        Assert.All(bookings, booking => Assert.Equal(175m, booking.TotalPrice));
        Assert.All(bookings, booking => Assert.Null(booking.CancelledAt));
        var today = HotelBookingRules.TodayInBaku(DateTimeOffset.UtcNow);
        var result = await SetUser(new BookingRequestsController(db), 9, UserRoles.User).CreateBookingRequest(new BookingRequestCreateDto
        {
            HotelRoomId = 10, CustomerName = "Guest", PhoneNumber = "555000", Email = "guest@example.com",
            CheckInDate = today.AddDays(3), CheckOutDate = today.AddDays(4)
        });
        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(2, await db.BookingRequests.CountAsync());
    }

    [Fact]
    public async Task OwnerCannotPayOrCancelGuestsBooking()
    {
        await using var db = await CreateDb();
        db.BookingRequests.Add(Booking(1, status: BookingStatus.PendingPayment));
        await db.SaveChangesAsync();
        var controller = SetUser(new BookingRequestsController(db), 1, UserRoles.HotelOwner);
        Assert.IsType<ForbidResult>(await controller.CancelBookingRequest(1));
        Assert.IsType<ForbidResult>((await controller.PayBookingRequest(1, new BookingPaymentDto())).Result);
        Assert.Equal(BookingStatus.PendingPayment, (await db.BookingRequests.SingleAsync()).Status);
    }

    [Fact]
    public async Task CancelBooking_RetainsRecordAndCancellationTimestamp()
    {
        await using var db = await CreateDb();
        db.BookingRequests.Add(Booking(1));
        await db.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await SetUser(new BookingRequestsController(db), 9, UserRoles.User).CancelBookingRequest(1));
        var booking = await db.BookingRequests.SingleAsync();
        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.NotNull(booking.CancelledAt);
        Assert.Equal(175m, booking.TotalPrice);
    }

    [Fact]
    public async Task ExistingMinimumRoomTypesAndGuestPlacesStillApply()
    {
        await using var db = await CreateDb();
        db.HotelRooms.Remove((await db.HotelRooms.FindAsync(12))!);
        (await db.HotelRooms.FindAsync(11))!.TotalRooms = 1;
        await db.SaveChangesAsync();
        var controller = Controller(db);
        var delete = Assert.IsType<ConflictObjectResult>(await controller.DeleteHotelRoom(10));
        Assert.Equal("Hotel must have at least 2 room types.", delete.Value);
        var update = Assert.IsType<ConflictObjectResult>(await controller.UpdateHotelRoom(10, Update(totalRooms: 1)));
        Assert.Equal("Hotel rooms must fit at least 100 guests.", update.Value);
    }

    [Fact]
    public async Task AdminCannotMoveBookedRoomAndChangeItsHistoryHotel()
    {
        await using var db = await CreateDb();
        db.Hotels.Add(new Hotel { Id = 2, Name = "Other", City = "Baku" });
        db.BookingRequests.Add(Booking(1, -5, -3, BookingStatus.Cancelled));
        await db.SaveChangesAsync();
        var update = Update();
        update.HotelId = 2;
        Assert.IsType<ConflictObjectResult>(await SetUser(new HotelRoomsController(db), 99, UserRoles.Admin).UpdateHotelRoom(10, update));
        Assert.Equal(1, (await db.HotelRooms.FindAsync(10))!.HotelId);
    }

    private static HotelRoomUpdateDto Update(int totalRooms = 10, int capacity = 4) => new()
    {
        HotelId = 1, RoomType = "Standard", Capacity = capacity, TotalRooms = totalRooms, PricePerNight = 100, IsAvailable = true
    };

    private static BookingRequest Booking(int id, int checkIn = 0, int checkOut = 1, BookingStatus status = BookingStatus.Paid)
    {
        var today = HotelBookingRules.TodayInBaku(DateTimeOffset.UtcNow);
        return new BookingRequest
        {
            Id = id, HotelRoomId = 10, UserId = 9, CustomerName = "Guest", PhoneNumber = "555000", Email = "guest@example.com",
            CheckInDate = today.AddDays(checkIn), CheckOutDate = today.AddDays(checkOut), GuestsCount = 4, Status = status, TotalPrice = 175m,
            CancelledAt = status == BookingStatus.Cancelled ? DateTime.UtcNow.AddDays(-2) : null
        };
    }

    private static HotelRoomsController Controller(AppDbContext db) => SetUser(new HotelRoomsController(db), 1, UserRoles.HotelOwner);

    private static T SetUser<T>(T controller, int id, string role) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, role)], "TestAuth"))
            }
        };
        return controller;
    }

    private static async Task<AppDbContext> CreateDb()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);
        db.Hotels.Add(new Hotel { Id = 1, OwnerId = 1, Name = "Test Hotel", City = "Baku" });
        db.HotelRooms.AddRange(
            new HotelRoom { Id = 10, HotelId = 1, RoomType = "Standard", Capacity = 4, TotalRooms = 10, PricePerNight = 100 },
            new HotelRoom { Id = 11, HotelId = 1, RoomType = "Family", Capacity = 2, TotalRooms = 50 },
            new HotelRoom { Id = 12, HotelId = 1, RoomType = "Suite", Capacity = 2, TotalRooms = 50 });
        await db.SaveChangesAsync();
        return db;
    }
}

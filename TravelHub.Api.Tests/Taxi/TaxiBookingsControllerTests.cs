using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiBookingsControllerTests
{
    [Fact]
    public async Task CreateTaxiBooking_WithPendingBooking_CancelsPreviousAndCreatesPending()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        var previousBooking = CreateBooking(1, BookingStatus.PendingPayment);
        db.TaxiBookings.Add(previousBooking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id));

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var storedPreviousBooking = await db.TaxiBookings.FindAsync(previousBooking.Id);
        var pendingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == 1 && booking.Status == BookingStatus.PendingPayment)
            .ToListAsync();

        Assert.NotNull(storedPreviousBooking);
        Assert.Equal(BookingStatus.Cancelled, storedPreviousBooking.Status);
        Assert.NotNull(storedPreviousBooking.CancelledAt);
        Assert.Equal(BookingStatus.PendingPayment.ToString(), createdBooking.Status);
        Assert.Single(pendingBookings);
        Assert.Equal(createdBooking.Id, pendingBookings[0].Id);
    }

    [Fact]
    public async Task CreateTaxiBooking_WithMultiplePendingBookings_CancelsAllPrevious()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        db.TaxiBookings.AddRange(
            CreateBooking(1, BookingStatus.PendingPayment),
            CreateBooking(1, BookingStatus.PendingPayment),
            CreateBooking(1, BookingStatus.PendingPayment));
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id));

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var userBookings = await db.TaxiBookings.Where(booking => booking.UserId == 1).ToListAsync();
        var cancelledBookings = userBookings.Where(booking => booking.Status == BookingStatus.Cancelled).ToList();
        var pendingBookings = userBookings.Where(booking => booking.Status == BookingStatus.PendingPayment).ToList();

        Assert.Equal(3, cancelledBookings.Count);
        Assert.All(cancelledBookings, booking => Assert.NotNull(booking.CancelledAt));
        Assert.Single(pendingBookings);
        Assert.Equal(createdBooking.Id, pendingBookings[0].Id);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenPending_CancelsBooking()
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, BookingStatus.PendingPayment);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id);

        Assert.IsType<NoContentResult>(result);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(BookingStatus.Cancelled, storedBooking.Status);
        Assert.NotNull(storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenPaid_ReturnsConflictAndKeepsPaid()
    {
        await using var db = CreateDbContext();
        var paidAt = DateTime.UtcNow.AddMinutes(-1);
        var booking = CreateBooking(1, BookingStatus.Paid);
        booking.PaidAt = paidAt;
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("Only pending taxi bookings can be cancelled.", conflict.Value);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(BookingStatus.Paid, storedBooking.Status);
        Assert.Equal(paidAt, storedBooking.PaidAt);
        Assert.Null(storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenAlreadyCancelled_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var cancelledAt = DateTime.UtcNow.AddMinutes(-1);
        var booking = CreateBooking(1, BookingStatus.Cancelled);
        booking.CancelledAt = cancelledAt;
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("Only pending taxi bookings can be cancelled.", conflict.Value);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(BookingStatus.Cancelled, storedBooking.Status);
        Assert.Equal(cancelledAt, storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CreateTaxiBooking_DoesNotCancelAnotherUsersPendingBooking()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        var currentUsersBooking = CreateBooking(1, BookingStatus.PendingPayment);
        var otherUsersBooking = CreateBooking(2, BookingStatus.PendingPayment);
        db.TaxiBookings.AddRange(currentUsersBooking, otherUsersBooking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id));

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var storedCurrentUsersBooking = await db.TaxiBookings.FindAsync(currentUsersBooking.Id);
        var storedOtherUsersBooking = await db.TaxiBookings.FindAsync(otherUsersBooking.Id);
        var currentUsersPendingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == 1 && booking.Status == BookingStatus.PendingPayment)
            .ToListAsync();

        Assert.NotNull(storedCurrentUsersBooking);
        Assert.Equal(BookingStatus.Cancelled, storedCurrentUsersBooking.Status);
        Assert.NotNull(storedOtherUsersBooking);
        Assert.Equal(BookingStatus.PendingPayment, storedOtherUsersBooking.Status);
        Assert.Null(storedOtherUsersBooking.CancelledAt);
        Assert.Single(currentUsersPendingBookings);
        Assert.Equal(createdBooking.Id, currentUsersPendingBookings[0].Id);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static TaxiBookingsController CreateController(AppDbContext db, int userId)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, UserRoles.User)
            ],
            "Test");

        return new TaxiBookingsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(identity)
                }
            }
        };
    }

    private static async Task<TaxiService> AddTaxiServiceAsync(AppDbContext db)
    {
        var taxiService = new TaxiService
        {
            CompanyName = "Test Taxi",
            City = "Baku",
            PhoneNumber = "+994501234567",
            CarClasses =
            [
                new TaxiCarClass
                {
                    Name = "Standard",
                    PricePerKm = 2m
                }
            ]
        };

        db.TaxiServices.Add(taxiService);
        await db.SaveChangesAsync();
        return taxiService;
    }

    private static TaxiBookingCreateDto CreateBookingDto(int taxiServiceId) => new()
    {
        TaxiServiceId = taxiServiceId,
        CarClassName = "Standard",
        CustomerName = "Test User",
        PhoneNumber = "+994501234567",
        Email = "test@example.com",
        PickupAddress = "Pickup",
        DropoffAddress = "Dropoff",
        PickupX = 10m,
        PickupY = 20m,
        DropoffX = 30m,
        DropoffY = 40m
    };

    private static TaxiBooking CreateBooking(int userId, BookingStatus status) => new()
    {
        UserId = userId,
        TaxiServiceId = 1,
        TaxiServiceName = "Test Taxi",
        CarClassName = "Standard",
        CustomerName = "Test User",
        PhoneNumber = "+994501234567",
        Email = "test@example.com",
        PickupAddress = "Pickup",
        DropoffAddress = "Dropoff",
        PickupX = 10m,
        PickupY = 20m,
        DropoffX = 30m,
        DropoffY = 40m,
        DistanceKm = 28.28m,
        PricePerKm = 2m,
        TotalPrice = 56.56m,
        Status = status
    };
}

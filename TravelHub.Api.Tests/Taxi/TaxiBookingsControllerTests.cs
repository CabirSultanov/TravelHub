using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiBookingsControllerTests
{
    [Fact]
    public async Task CreateTaxiBooking_UsesRoutingDistanceAndStoredCarClassPrice()
    {
        await using var db = CreateDbContext();
        SeedTaxiData(db, 1.50m);
        var controller = CreateController(db, routingService: new FakeRoutingService(7.35m));

        var result = await controller.CreateTaxiBooking(CreateDto(), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<TaxiBookingResponseDto>(created.Value);
        var storedBooking = await db.TaxiBookings.SingleAsync();
        Assert.Equal(7.35m, response.DistanceKm);
        Assert.Equal(1.50m, response.PricePerKm);
        Assert.Equal(11.03m, response.TotalPrice);
        Assert.Equal(11.03m, storedBooking.TotalPrice);
    }

    [Fact]
    public async Task CreateTaxiBooking_WhenRoutingFails_DoesNotCreateBooking()
    {
        await using var db = CreateDbContext();
        SeedTaxiData(db, 1.50m);
        var controller = CreateController(db, routingService: new FailingRoutingService());

        var result = await controller.CreateTaxiBooking(CreateDto(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status.StatusCode);
        Assert.Empty(await db.TaxiBookings.ToListAsync());
    }

    [Fact]
    public async Task CreateTaxiBooking_WithPendingBooking_CancelsPreviousAndCreatesPending()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        var previousBooking = CreateBooking(1, TaxiBookingStatus.AwaitingDriver);
        db.TaxiBookings.Add(previousBooking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id), CancellationToken.None);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var storedPreviousBooking = await db.TaxiBookings.FindAsync(previousBooking.Id);
        var pendingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == 1 && booking.Status == TaxiBookingStatus.AwaitingDriver)
            .ToListAsync();

        Assert.NotNull(storedPreviousBooking);
        Assert.Equal(TaxiBookingStatus.Cancelled, storedPreviousBooking.Status);
        Assert.NotNull(storedPreviousBooking.CancelledAt);
        Assert.Equal(TaxiBookingStatus.AwaitingDriver.ToString(), createdBooking.Status);
        Assert.Single(pendingBookings);
        Assert.Equal(createdBooking.Id, pendingBookings[0].Id);
    }

    [Fact]
    public async Task CreateTaxiBooking_WithMultiplePendingBookings_CancelsAllPrevious()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        db.TaxiBookings.AddRange(
            CreateBooking(1, TaxiBookingStatus.AwaitingDriver),
            CreateBooking(1, TaxiBookingStatus.AwaitingDriver),
            CreateBooking(1, TaxiBookingStatus.AwaitingDriver));
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id), CancellationToken.None);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var userBookings = await db.TaxiBookings.Where(booking => booking.UserId == 1).ToListAsync();
        var cancelledBookings = userBookings.Where(booking => booking.Status == TaxiBookingStatus.Cancelled).ToList();
        var pendingBookings = userBookings.Where(booking => booking.Status == TaxiBookingStatus.AwaitingDriver).ToList();

        Assert.Equal(3, cancelledBookings.Count);
        Assert.All(cancelledBookings, booking => Assert.NotNull(booking.CancelledAt));
        Assert.Single(pendingBookings);
        Assert.Equal(createdBooking.Id, pendingBookings[0].Id);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenPending_CancelsBooking()
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.AwaitingDriver);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id, default);

        Assert.IsType<NoContentResult>(result);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(TaxiBookingStatus.Cancelled, storedBooking.Status);
        Assert.NotNull(storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenPaid_ReturnsConflictAndKeepsPaid()
    {
        await using var db = CreateDbContext();
        var paidAt = DateTime.UtcNow.AddMinutes(-1);
        var booking = CreateBooking(1, TaxiBookingStatus.DriverAssigned);
        booking.PaidAt = paidAt;
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id, default);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("Only taxi bookings waiting for a driver can be cancelled.", conflict.Value);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(TaxiBookingStatus.DriverAssigned, storedBooking.Status);
        Assert.Equal(paidAt, storedBooking.PaidAt);
        Assert.Null(storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CancelTaxiBooking_WhenAlreadyCancelled_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var cancelledAt = DateTime.UtcNow.AddMinutes(-1);
        var booking = CreateBooking(1, TaxiBookingStatus.Cancelled);
        booking.CancelledAt = cancelledAt;
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CancelTaxiBooking(booking.Id, default);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("Only taxi bookings waiting for a driver can be cancelled.", conflict.Value);
        db.ChangeTracker.Clear();
        var storedBooking = await db.TaxiBookings.FindAsync(booking.Id);
        Assert.NotNull(storedBooking);
        Assert.Equal(TaxiBookingStatus.Cancelled, storedBooking.Status);
        Assert.Equal(cancelledAt, storedBooking.CancelledAt);
    }

    [Fact]
    public async Task CreateTaxiBooking_DoesNotCancelAnotherUsersPendingBooking()
    {
        await using var db = CreateDbContext();
        var taxiService = await AddTaxiServiceAsync(db);
        var currentUsersBooking = CreateBooking(1, TaxiBookingStatus.AwaitingDriver);
        var otherUsersBooking = CreateBooking(2, TaxiBookingStatus.AwaitingDriver);
        db.TaxiBookings.AddRange(currentUsersBooking, otherUsersBooking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).CreateTaxiBooking(CreateBookingDto(taxiService.Id), CancellationToken.None);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var createdBooking = Assert.IsType<TaxiBookingResponseDto>(createdResult.Value);
        db.ChangeTracker.Clear();
        var storedCurrentUsersBooking = await db.TaxiBookings.FindAsync(currentUsersBooking.Id);
        var storedOtherUsersBooking = await db.TaxiBookings.FindAsync(otherUsersBooking.Id);
        var currentUsersPendingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == 1 && booking.Status == TaxiBookingStatus.AwaitingDriver)
            .ToListAsync();

        Assert.NotNull(storedCurrentUsersBooking);
        Assert.Equal(TaxiBookingStatus.Cancelled, storedCurrentUsersBooking.Status);
        Assert.NotNull(storedOtherUsersBooking);
        Assert.Equal(TaxiBookingStatus.AwaitingDriver, storedOtherUsersBooking.Status);
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

    private static TaxiBookingsController CreateController(
        AppDbContext db,
        int userId = 1,
        IRoutingService? routingService = null)
    {
        var controller = new TaxiBookingsController(db, routingService ?? new FakeRoutingService(28.28m));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                        new Claim(ClaimTypes.Role, UserRoles.User)
                    ],
                    "TestAuth"))
            }
        };
        return controller;
    }

    private static void SeedTaxiData(AppDbContext db, decimal pricePerKm)
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
        db.TaxiServices.Add(new TaxiService
        {
            Id = 10,
            CompanyName = "Baku Taxi",
            City = "Baku",
            PhoneNumber = "+994 121111111",
            Description = "City taxi",
            CarClasses =
            [
                new TaxiCarClass
                {
                    Id = 100,
                    Name = "Comfort",
                    PricePerKm = pricePerKm
                }
            ]
        });
        db.SaveChanges();
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

    private static TaxiBookingCreateDto CreateDto() => new()
    {
        TaxiServiceId = 10,
        CarClassName = "Comfort",
        CustomerName = "Jane Doe",
        PhoneNumber = "+994 501234567",
        Email = "jane@example.com",
        PickupAddress = "Airport terminal",
        DropoffAddress = "City center",
        PickupLatitude = 40.4675m,
        PickupLongitude = 50.0467m,
        DropoffLatitude = 40.4093m,
        DropoffLongitude = 49.8671m,
        Payment = Payment()
    };

    private static TaxiBookingCreateDto CreateBookingDto(int taxiServiceId) => new()
    {
        TaxiServiceId = taxiServiceId,
        CarClassName = "Standard",
        CustomerName = "Test User",
        PhoneNumber = "+994501234567",
        Email = "test@example.com",
        PickupAddress = "Pickup",
        DropoffAddress = "Dropoff",
        PickupLatitude = 40.4675m,
        PickupLongitude = 50.0467m,
        DropoffLatitude = 40.4093m,
        DropoffLongitude = 49.8671m,
        Payment = Payment()
    };

    private static TaxiBooking CreateBooking(int userId, TaxiBookingStatus status) => new()
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
        PickupLatitude = 40.4675m,
        PickupLongitude = 50.0467m,
        DropoffLatitude = 40.4093m,
        DropoffLongitude = 49.8671m,
        DistanceKm = 28.28m,
        PricePerKm = 2m,
        TotalPrice = 56.56m,
        Status = status
    };

    private static BookingPaymentDto Payment() => new()
    {
        CardNumber = "4111111111111111",
        CardHolderName = "Jane Doe",
        ExpiryMonth = 12,
        ExpiryYear = DateTime.UtcNow.Year + 1,
        Cvv = "123"
    };

    private sealed class FakeRoutingService(decimal distanceKm) : IRoutingService
    {
        public Task<TaxiRouteResult> GetRouteAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) =>
            Task.FromResult(new TaxiRouteResult(distanceKm, 820, "encoded"));
    }

    private sealed class FailingRoutingService : IRoutingService
    {
        public Task<TaxiRouteResult> GetRouteAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) =>
            throw new RoutingUnavailableException("No route");
    }
}

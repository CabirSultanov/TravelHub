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

    [Theory]
    [InlineData(1, UserRoles.User)]
    [InlineData(2, UserRoles.Admin)]
    [InlineData(2, UserRoles.SuperAdmin)]
    public async Task GetTaxiBooking_AllowsOwnerAndAdminsAndReturnsDriverAndReview(int userId, string role)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.Completed);
        booking.Driver = new AppUser { Name = "Driver Name", PhoneNumber = "+994501111111", Email = "driver@example.com", PasswordHash = "hash" };
        booking.Rating = 4;
        booking.ReviewComment = "Good ride";
        booking.ReviewedAt = DateTime.UtcNow;
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await CreateController(db, userId, role: role).GetTaxiBooking(booking.Id, default);

        Assert.Equal(booking.Id, result.Value!.Id);
        Assert.Equal("Driver Name", result.Value.DriverName);
        Assert.Equal("+994501111111", result.Value.DriverPhoneNumber);
        Assert.Equal(4, result.Value.Rating);
        Assert.Equal("Good ride", result.Value.ReviewComment);
        Assert.Equal(DateTimeKind.Utc, result.Value.ReviewedAt!.Value.Kind);
    }

    [Theory]
    [InlineData(UserRoles.User)]
    [InlineData(UserRoles.TaxiDriver)]
    [InlineData(UserRoles.TaxiOwner)]
    public async Task GetTaxiBooking_DeniesUnrelatedUser(string role)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.DriverAssigned);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 2, role: role).GetTaxiBooking(booking.Id, default);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetTaxiBooking_UnknownBookingReturnsNotFound()
    {
        await using var db = CreateDbContext();
        var result = await CreateController(db).GetTaxiBooking(999, default);
        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task DetailAndReview_RequireAuthenticatedUserId()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity());

        Assert.IsType<UnauthorizedResult>((await controller.GetTaxiBooking(1, default)).Result);
        Assert.IsType<UnauthorizedResult>((await controller.ReviewTaxiBooking(1, new() { Rating = 5 }, default)).Result);
    }

    [Theory]
    [InlineData(UserRoles.User)]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task ReviewTaxiBooking_OwnerCanReviewOnceAndReadPersistedReview(string role)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.Completed);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();
        var controller = CreateController(db, role: role);

        var result = await controller.ReviewTaxiBooking(booking.Id, new() { Rating = 5, Comment = "  Excellent ride  " }, default);

        Assert.Equal(5, result.Value!.Rating);
        Assert.Equal("Excellent ride", result.Value.ReviewComment);
        Assert.NotNull(result.Value.ReviewedAt);
        db.ChangeTracker.Clear();
        var detail = await controller.GetTaxiBooking(booking.Id, default);
        var history = await controller.GetTaxiBookings(mine: true);
        Assert.Equal(5, detail.Value!.Rating);
        Assert.Equal("Excellent ride", Assert.Single(history.Value!).ReviewComment);

        var duplicate = await controller.ReviewTaxiBooking(booking.Id, new() { Rating = 1, Comment = "Replacement" }, default);

        Assert.IsType<ConflictObjectResult>(duplicate.Result);
        db.ChangeTracker.Clear();
        Assert.Equal(5, (await db.TaxiBookings.SingleAsync()).Rating);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ReviewTaxiBooking_CommentIsOptional(string? comment)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.Completed);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db).ReviewTaxiBooking(booking.Id, new() { Rating = 1, Comment = comment }, default);

        Assert.Equal(1, result.Value!.Rating);
        Assert.Null(result.Value.ReviewComment);
    }

    [Theory]
    [InlineData(UserRoles.User)]
    [InlineData(UserRoles.TaxiDriver)]
    [InlineData(UserRoles.TaxiOwner)]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task ReviewTaxiBooking_OnlyBookingOwnerCanWrite(string role)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.Completed);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 2, role: role).ReviewTaxiBooking(booking.Id, new() { Rating = 5 }, default);

        Assert.IsType<ForbidResult>(result.Result);
        Assert.Null(booking.Rating);
    }

    [Theory]
    [InlineData(TaxiBookingStatus.AwaitingDriver)]
    [InlineData(TaxiBookingStatus.DriverAssigned)]
    [InlineData(TaxiBookingStatus.DriverArrived)]
    [InlineData(TaxiBookingStatus.Cancelled)]
    [InlineData(TaxiBookingStatus.PendingPayment)]
    [InlineData(TaxiBookingStatus.Paid)]
    public async Task ReviewTaxiBooking_OnlyCompletedCanBeReviewed(TaxiBookingStatus status)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, status);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db).ReviewTaxiBooking(booking.Id, new() { Rating = 5 }, default);

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Null(booking.Rating);
        Assert.Equal(status, booking.Status);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(6, 0)]
    [InlineData(5, 1001)]
    public async Task ReviewTaxiBooking_InvalidRatingOrCommentDoesNotPersist(int rating, int commentLength)
    {
        await using var db = CreateDbContext();
        var booking = CreateBooking(1, TaxiBookingStatus.Completed);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();

        var result = await CreateController(db).ReviewTaxiBooking(booking.Id, new() { Rating = rating, Comment = new string('x', commentLength) }, default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(booking.Rating);
        Assert.Null(booking.ReviewedAt);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ReviewAndCancel_ConcurrentUpdateReturnsConflictAndDoesNotPersist(bool review)
    {
        var interceptor = new ConcurrentSaveInterceptor();
        await using var db = CreateDbContext(interceptor);
        var status = review ? TaxiBookingStatus.Completed : TaxiBookingStatus.AwaitingDriver;
        var booking = CreateBooking(1, status);
        db.TaxiBookings.Add(booking);
        await db.SaveChangesAsync();
        interceptor.ThrowOnSave = true;
        var controller = CreateController(db);

        IActionResult? result = review
            ? (await controller.ReviewTaxiBooking(booking.Id, new() { Rating = 5 }, default)).Result
            : await controller.CancelTaxiBooking(booking.Id, default);

        Assert.IsType<ConflictObjectResult>(result);
        db.ChangeTracker.Clear();
        var stored = await db.TaxiBookings.SingleAsync();
        Assert.Equal(status, stored.Status);
        Assert.Null(stored.Rating);
        Assert.Null(stored.CancelledAt);
    }

    private static AppDbContext CreateDbContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(interceptors)
            .Options;

        return new AppDbContext(options);
    }

    private static TaxiBookingsController CreateController(
        AppDbContext db,
        int userId = 1,
        IRoutingService? routingService = null,
        string role = UserRoles.User)
    {
        var controller = new TaxiBookingsController(db, routingService ?? new FakeRoutingService(28.28m));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                        new Claim(ClaimTypes.Role, role)
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

    private sealed class ConcurrentSaveInterceptor : SaveChangesInterceptor
    {
        public bool ThrowOnSave { get; set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default) =>
            ThrowOnSave ? throw new DbUpdateConcurrencyException("Concurrent booking update") : ValueTask.FromResult(result);
    }
}

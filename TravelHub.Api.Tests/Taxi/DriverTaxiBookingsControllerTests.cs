using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Taxi;

public class DriverTaxiBookingsControllerTests
{
    [Fact]
    public async Task Available_OnlyReturnsRidesFromDriversTaxiService()
    {
        await using var db = CreateDb();
        await SeedAsync(db);

        var result = await Controller(db, 10).GetAvailable(default);

        var rides = Assert.IsType<List<TaxiDriverRideResponseDto>>(result.Value);
        Assert.Single(rides);
        Assert.Equal(100, rides[0].Id);
    }

    [Fact]
    public async Task Decline_HidesRideOnlyForThatDriver()
    {
        await using var db = CreateDb();
        await SeedAsync(db);
        db.Users.Add(Driver(11, 1));
        await db.SaveChangesAsync();

        Assert.IsType<NoContentResult>(await Controller(db, 10).Decline(100, default));
        Assert.Empty((await Controller(db, 10).GetAvailable(default)).Value!);
        Assert.Single((await Controller(db, 11).GetAvailable(default)).Value!);
    }

    [Fact]
    public async Task FirstAccept_AssignsRideAndOtherDriverCannotAccept()
    {
        await using var db = CreateDb();
        await SeedAsync(db);
        db.Users.Add(Driver(11, 1));
        await db.SaveChangesAsync();

        var accepted = await Controller(db, 10).Accept(100, default);
        var secondAttempt = await Controller(db, 11).Accept(100, default);

        Assert.Equal("DriverAssigned", accepted.Value!.Status);
        Assert.IsType<ConflictObjectResult>(secondAttempt.Result);
        var booking = await db.TaxiBookings.FindAsync(100);
        Assert.Equal(10, booking!.DriverId);
        Assert.NotNull(booking.PaidAt);
    }

    [Fact]
    public async Task Driver_MustArriveBeforeCompletingRide()
    {
        await using var db = CreateDb();
        await SeedAsync(db);
        var controller = Controller(db, 10);
        await controller.Accept(100, default);

        Assert.IsType<ConflictObjectResult>((await controller.Complete(100, default)).Result);
        Assert.Equal("DriverArrived", (await controller.Arrived(100, default)).Value!.Status);
        Assert.Equal("Completed", (await controller.Complete(100, default)).Value!.Status);
        Assert.Single((await controller.GetHistory(default)).Value!);
    }

    [Fact]
    public async Task SimultaneousAccepts_OnlyOneDriverWinsAndPaymentIsNotOverwritten()
    {
        var gate = new CompetingAcceptsInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(gate)
            .Options;
        await using (var seed = new AppDbContext(options))
        {
            await SeedAsync(seed);
            seed.Users.Add(Driver(11, 1));
            await seed.SaveChangesAsync();
            var version = seed.Model.FindEntityType(typeof(TaxiBooking))!.FindProperty(nameof(TaxiBooking.RowVersion))!;
            Assert.True(version.IsConcurrencyToken);
            Assert.Equal(ValueGenerated.OnAddOrUpdate, version.ValueGenerated);
        }

        // Independent requests both read AwaitingDriver before either is allowed to save.
        await using var firstDb = new AppDbContext(options);
        await using var secondDb = new AppDbContext(options);
        gate.Enabled = true;
        var first = Controller(firstDb, 10).Accept(100, default);
        var second = Controller(secondDb, 11).Accept(100, default);
        var results = await Task.WhenAll(first, second).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Single(results, result => result.Value?.Status == "DriverAssigned");
        var conflict = Assert.Single(results, result => result.Result is ConflictObjectResult);
        Assert.Equal("This ride was accepted by another driver.", ((ConflictObjectResult)conflict.Result!).Value);

        await using var verify = new AppDbContext(options);
        var stored = (await verify.TaxiBookings.FindAsync(100))!;
        var winningDriver = results[0].Value is not null ? 10 : 11;
        Assert.Equal(winningDriver, stored.DriverId);
        Assert.Equal(TaxiBookingStatus.DriverAssigned, stored.Status);
        Assert.NotNull(stored.AcceptedAt);
        Assert.NotNull(stored.PaidAt);
        Assert.Empty((await Controller(verify, winningDriver == 10 ? 11 : 10).GetAvailable(default)).Value!);
        Assert.Equal(stored.AcceptedAt, results.Single(result => result.Value is not null).Value!.AcceptedAt);
    }

    // InMemory does not generate SQL Server rowversion values. Simulate that database
    // behavior here while testing the real EF concurrency check and controller response.
    private sealed class CompetingAcceptsInterceptor : SaveChangesInterceptor
    {
        private readonly TaskCompletionSource bothReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int arrivals;
        public bool Enabled { get; set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!Enabled) return result;
            var booking = eventData.Context!.ChangeTracker.Entries<TaxiBooking>()
                .Single(entry => entry.Entity.Id == 100);
            booking.Property(item => item.RowVersion).CurrentValue = Guid.NewGuid().ToByteArray();
            if (Interlocked.Increment(ref arrivals) == 2) bothReady.TrySetResult();
            await bothReady.Task.WaitAsync(TimeSpan.FromSeconds(5), cancellationToken);
            return result;
        }
    }

    [Fact]
    public async Task NonDriverCannotUseDriverEndpoints()
    {
        await using var db = CreateDb();
        await SeedAsync(db);
        db.Users.Add(new AppUser { Id = 20, Name = "Admin", Email = "admin@example.com", PhoneNumber = "+994501234567", PasswordHash = "hash", Role = UserRoles.Admin });
        await db.SaveChangesAsync();

        var result = await Controller(db, 20, UserRoles.Admin).GetAvailable(default);

        Assert.IsType<ForbidResult>(result.Result);
    }

    private static async Task SeedAsync(AppDbContext db)
    {
        db.TaxiServices.AddRange(Service(1), Service(2));
        db.Users.Add(Driver(10, 1));
        db.TaxiBookings.AddRange(Ride(100, 1), Ride(101, 2));
        await db.SaveChangesAsync();
    }

    private static DriverTaxiBookingsController Controller(AppDbContext db, int userId, string role = UserRoles.TaxiDriver)
    {
        var controller = new DriverTaxiBookingsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)], "TestAuth"))
            }
        };
        return controller;
    }

    private static AppDbContext CreateDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private static TaxiService Service(int id) => new() { Id = id, CompanyName = $"Taxi {id}", City = "Baku", PhoneNumber = "+994501234567", Description = "Taxi" };

    private static AppUser Driver(int id, int serviceId) => new()
    {
        Id = id, Name = $"Driver {id}", Email = $"driver{id}@example.com", PhoneNumber = "+994501234567", PasswordHash = "hash", Role = UserRoles.TaxiDriver, TaxiServiceId = serviceId
    };

    private static TaxiBooking Ride(int id, int serviceId) => new()
    {
        Id = id, UserId = 30, TaxiServiceId = serviceId, TaxiServiceName = $"Taxi {serviceId}", CarClassName = "Standard", CustomerName = "Customer", PhoneNumber = "+994501234567", Email = "customer@example.com", PickupAddress = "Pickup", DropoffAddress = "Dropoff", DistanceKm = 5m, PricePerKm = 2m, TotalPrice = 10m, Status = TaxiBookingStatus.AwaitingDriver, PaymentToken = "demo-token", SavedCardLast4 = "1111"
    };
}

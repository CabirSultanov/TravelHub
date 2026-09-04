using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

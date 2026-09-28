using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TravelHub.Api.Configuration;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Auth;

public class AccountDeletionTests
{
    [Theory]
    [InlineData(false, UserRoles.TaxiDriver)]
    [InlineData(true, UserRoles.TaxiDriver)]
    [InlineData(false, UserRoles.User)]
    [InlineData(true, UserRoles.User)]
    public async Task DeleteAccount_CleansDriverReferencesAndPreservesBookingHistory(bool selfDelete, string role)
    {
        await using var db = CreateDb();
        await SeedAsync(db, role);

        var result = await DeleteAsync(db, selfDelete);

        Assert.IsType<NoContentResult>(result);
        db.ChangeTracker.Clear();
        Assert.Null(await db.Users.FindAsync(1));
        Assert.Equal(2, await db.Users.CountAsync());
        Assert.False(await db.TaxiBookingDriverDeclines.AnyAsync(decline => decline.DriverId == 1));
        var remainingDecline = await db.TaxiBookingDriverDeclines.SingleAsync();
        Assert.Equal(2, remainingDecline.DriverId);
        Assert.Equal(1, remainingDecline.TaxiBookingId);

        var rides = await db.TaxiBookings.OrderBy(booking => booking.Id).ToListAsync();
        Assert.Equal(3, rides.Count);
        Assert.Null(rides[0].DriverId);
        Assert.Null(rides[1].DriverId);
        Assert.Equal(TaxiBookingStatus.Completed, rides[0].Status);
        Assert.Equal(TaxiBookingStatus.Cancelled, rides[1].Status);
        Assert.Equal(25m, rides[0].TotalPrice);
        Assert.Equal(5, rides[0].Rating);
        Assert.Equal("Great ride", rides[0].ReviewComment);
        Assert.NotNull(rides[0].CompletedAt);
        Assert.NotNull(rides[1].CancelledAt);
        Assert.All(rides, ride => Assert.Equal(3, ride.UserId));
        Assert.Equal(2, rides[2].DriverId);
        Assert.Equal(TaxiBookingStatus.DriverAssigned, rides[2].Status);

        var hotelBookings = await db.BookingRequests.OrderBy(booking => booking.Id).ToListAsync();
        Assert.Equal(2, hotelBookings.Count);
        Assert.Null(hotelBookings[0].UserId);
        Assert.Equal(BookingStatus.Paid, hotelBookings[0].Status);
        Assert.Equal("Guest 1", hotelBookings[0].CustomerName);
        Assert.Equal(100m, hotelBookings[0].TotalPrice);
        Assert.Equal(2, hotelBookings[1].UserId);
    }

    [Theory]
    [InlineData(false, TaxiBookingStatus.DriverAssigned)]
    [InlineData(true, TaxiBookingStatus.DriverAssigned)]
    [InlineData(false, TaxiBookingStatus.DriverArrived)]
    [InlineData(true, TaxiBookingStatus.DriverArrived)]
    public async Task DeleteAccount_WithActiveDriverRide_RejectsWithoutChanges(bool selfDelete, TaxiBookingStatus status)
    {
        await using var db = CreateDb();
        await SeedAsync(db, UserRoles.User, status);

        var result = await DeleteAsync(db, selfDelete);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("An account with an active driver ride cannot be deleted. Finish the ride first.", conflict.Value);
        Assert.All(db.ChangeTracker.Entries(), entry => Assert.Equal(EntityState.Unchanged, entry.State));
        db.ChangeTracker.Clear();
        Assert.Equal(3, await db.Users.CountAsync());
        Assert.NotNull(await db.Users.FindAsync(1));
        Assert.Equal(2, await db.TaxiBookingDriverDeclines.CountAsync());
        Assert.Equal(3, await db.TaxiBookings.CountAsync());
        Assert.Equal(2, await db.TaxiBookings.CountAsync(booking => booking.DriverId == 1));
        Assert.Equal(status, (await db.TaxiBookings.FindAsync(1))!.Status);
        Assert.Equal(1, (await db.BookingRequests.FindAsync(1))!.UserId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DeleteAccount_SuperAdmin_IsRejected(bool selfDelete)
    {
        await using var db = CreateDb();
        db.Users.Add(User(1, UserRoles.SuperAdmin));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await DeleteAsync(db, selfDelete);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(await db.Users.FindAsync(1));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DeleteAccount_MissingUser_ReturnsNotFound(bool selfDelete)
    {
        await using var db = CreateDb();

        Assert.IsType<NotFoundResult>(await DeleteAsync(db, selfDelete));
    }

    private static async Task<IActionResult> DeleteAsync(AppDbContext db, bool selfDelete)
    {
        if (!selfDelete)
        {
            return await new AdminsController(db, new PasswordHasher<AppUser>()).DeleteAccount(1);
        }

        var controller = new AuthController(
            db, new PasswordHasher<AppUser>(), null!, Options.Create(new JwtOptions()),
            new EphemeralDataProtectionProvider(), null!, NullLogger<AuthController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "1")], "TestAuth"))
                }
            }
        };

        var result = await controller.DeleteMe();
        if (result is NoContentResult)
        {
            Assert.Contains("TravelHub.RefreshToken=;", controller.Response.Headers.SetCookie.ToString());
        }
        else
        {
            Assert.Equal(0, controller.Response.Headers.SetCookie.Count);
        }

        return result;
    }

    private static AppDbContext CreateDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task SeedAsync(AppDbContext db, string role, TaxiBookingStatus firstRideStatus = TaxiBookingStatus.Completed)
    {
        db.Users.AddRange(User(1, role), User(2, UserRoles.TaxiDriver), User(3));
        db.TaxiBookings.AddRange(
            Ride(1, 1, firstRideStatus),
            Ride(2, 1, TaxiBookingStatus.Cancelled),
            Ride(3, 2, TaxiBookingStatus.DriverAssigned));
        db.TaxiBookingDriverDeclines.AddRange(
            new TaxiBookingDriverDecline { TaxiBookingId = 3, DriverId = 1 },
            new TaxiBookingDriverDecline { TaxiBookingId = 1, DriverId = 2 });
        db.BookingRequests.AddRange(HotelBooking(1), HotelBooking(2));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    private static AppUser User(int id, string role = UserRoles.User) => new()
    {
        Id = id,
        Name = $"User {id}",
        Email = $"user{id}@example.com",
        PhoneNumber = "+994501234567",
        PasswordHash = "hash",
        Role = role
    };

    private static TaxiBooking Ride(int id, int driverId, TaxiBookingStatus status) => new()
    {
        Id = id,
        UserId = 3,
        DriverId = driverId,
        TaxiServiceId = 1,
        TaxiServiceName = "Taxi",
        CarClassName = "Standard",
        CustomerName = "Customer",
        PhoneNumber = "+994501234567",
        Email = "customer@example.com",
        PickupAddress = "Pickup",
        DropoffAddress = "Dropoff",
        Status = status,
        TotalPrice = 25m,
        CompletedAt = status == TaxiBookingStatus.Completed ? DateTime.UtcNow : null,
        CancelledAt = status == TaxiBookingStatus.Cancelled ? DateTime.UtcNow : null,
        Rating = status == TaxiBookingStatus.Completed ? 5 : null,
        ReviewComment = status == TaxiBookingStatus.Completed ? "Great ride" : null
    };

    private static BookingRequest HotelBooking(int id) => new()
    {
        Id = id,
        UserId = id,
        HotelRoomId = 1,
        CustomerName = $"Guest {id}",
        PhoneNumber = "+994501234567",
        Email = $"guest{id}@example.com",
        Status = BookingStatus.Paid,
        TotalPrice = 100m
    };
}

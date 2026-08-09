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
        var controller = CreateController(db, new FakeRoutingService(7.35m));

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
        var controller = CreateController(db, new FailingRoutingService());

        var result = await controller.CreateTaxiBooking(CreateDto(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status.StatusCode);
        Assert.Empty(await db.TaxiBookings.ToListAsync());
    }

    private static TaxiBookingsController CreateController(AppDbContext db, IRoutingService routingService)
    {
        var controller = new TaxiBookingsController(db, routingService);
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
        DropoffLongitude = 49.8671m
    };

    private sealed class FakeRoutingService(decimal distanceKm) : IRoutingService
    {
        public Task<decimal> GetDrivingDistanceKmAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) => Task.FromResult(distanceKm);
    }

    private sealed class FailingRoutingService : IRoutingService
    {
        public Task<decimal> GetDrivingDistanceKmAsync(
            decimal pickupLatitude,
            decimal pickupLongitude,
            decimal dropoffLatitude,
            decimal dropoffLongitude,
            CancellationToken cancellationToken) =>
            throw new RoutingUnavailableException("No route");
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Ownership;

public class OwnershipAuthorizationTests
{
    [Theory]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task Administrator_CanAssignHotelOwner(string role)
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: null));
        db.Users.Add(User(2));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, role).UpdateHotelOwner(1, new OwnerAssignmentDto { OwnerId = 2 }, default);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(2, (await db.Hotels.SingleAsync()).OwnerId);
        Assert.Equal(UserRoles.HotelOwner, (await db.Users.FindAsync(2))!.Role);
    }

    [Fact]
    public async Task HotelOwner_CannotAssignOwnership()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 1));
        db.Users.AddRange(User(1, UserRoles.HotelOwner), User(2));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, UserRoles.HotelOwner).UpdateHotelOwner(1, new OwnerAssignmentDto { OwnerId = 2 }, default);

        Assert.IsType<ForbidResult>(result);
        Assert.Equal(1, (await db.Hotels.SingleAsync()).OwnerId);
    }

    [Fact]
    public async Task HotelOwner_CanEditOwnHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 1));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, UserRoles.HotelOwner).UpdateHotel(1, HotelUpdate());

        Assert.IsType<NoContentResult>(result);
        Assert.Equal("Updated hotel", (await db.Hotels.SingleAsync()).Name);
    }

    [Fact]
    public async Task HotelOwner_CannotEditAnotherHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 2));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, UserRoles.HotelOwner).UpdateHotel(1, HotelUpdate());

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task HotelOwner_CanManageRoomsOfOwnHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 1));
        await db.SaveChangesAsync();

        var result = await RoomController(db, 1, UserRoles.HotelOwner).CreateHotelRoom(RoomCreate());

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(1, (await db.HotelRooms.SingleAsync()).HotelId);
    }

    [Fact]
    public async Task HotelOwner_CannotManageRoomsOfAnotherHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 2));
        await db.SaveChangesAsync();

        var result = await RoomController(db, 1, UserRoles.HotelOwner).CreateHotelRoom(RoomCreate());

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task HotelOwner_CannotMoveOwnRoomToAnotherHotel()
    {
        await using var db = CreateDb();
        db.Hotels.AddRange(Hotel(1, 1), Hotel(2, 2));
        db.HotelRooms.AddRange(Room(1, 1, "Standard"), Room(2, 1, "Family"));
        await db.SaveChangesAsync();

        var result = await RoomController(db, 1, UserRoles.HotelOwner).UpdateHotelRoom(1, RoomUpdate(2, "Standard"));

        Assert.IsType<ForbidResult>(result);
        Assert.Equal(1, (await db.HotelRooms.FindAsync(1))!.HotelId);
    }

    [Fact]
    public async Task HotelOwner_CannotDeleteHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 1));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, UserRoles.HotelOwner).DeleteHotel(1);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task Admin_CanManageEveryHotelIncludingUnownedHotel()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: null));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 9, UserRoles.Admin).UpdateHotel(1, HotelUpdate());

        Assert.IsType<NoContentResult>(result);
        Assert.Equal("Updated hotel", (await db.Hotels.SingleAsync()).Name);
    }

    [Fact]
    public async Task Admin_CanAssignTaxiOwner()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(ownerId: null));
        db.Users.Add(User(2));
        await db.SaveChangesAsync();

        var result = await TaxiController(db, 1, UserRoles.Admin).UpdateTaxiServiceOwner(1, new OwnerAssignmentDto { OwnerId = 2 }, default);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(2, (await db.TaxiServices.SingleAsync()).OwnerId);
        Assert.Equal(UserRoles.TaxiOwner, (await db.Users.FindAsync(2))!.Role);
    }

    [Fact]
    public async Task TaxiOwner_CanEditOwnTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(ownerId: 1));
        await db.SaveChangesAsync();

        var result = await TaxiController(db, 1, UserRoles.TaxiOwner).UpdateTaxiService(1, TaxiUpdate("Updated taxi"));

        Assert.Equal("Updated taxi", Assert.IsType<TaxiService>(result.Value).CompanyName);
    }

    [Fact]
    public async Task TaxiOwner_CannotEditAnotherTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(ownerId: 2));
        await db.SaveChangesAsync();

        var result = await TaxiController(db, 1, UserRoles.TaxiOwner).UpdateTaxiService(1, TaxiUpdate("Updated taxi"));

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task TaxiOwner_CannotDeleteTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(ownerId: 1));
        await db.SaveChangesAsync();

        var result = await TaxiController(db, 1, UserRoles.TaxiOwner).DeleteTaxiService(1);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task Admin_CanManageUnownedTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(ownerId: null));
        await db.SaveChangesAsync();

        var result = await TaxiController(db, 9, UserRoles.Admin).UpdateTaxiService(1, TaxiUpdate("Updated taxi"));

        Assert.Equal("Updated taxi", Assert.IsType<TaxiService>(result.Value).CompanyName);
    }

    [Fact]
    public async Task RemovingLastHotelOwnerAssignment_ReturnsUserToRegularRole()
    {
        await using var db = CreateDb();
        db.Hotels.Add(Hotel(ownerId: 2));
        db.Users.Add(User(2, UserRoles.HotelOwner));
        await db.SaveChangesAsync();

        var result = await HotelController(db, 1, UserRoles.Admin).UpdateHotelOwner(1, new OwnerAssignmentDto(), default);

        Assert.IsType<NoContentResult>(result);
        Assert.Null((await db.Hotels.SingleAsync()).OwnerId);
        Assert.Equal(UserRoles.User, (await db.Users.FindAsync(2))!.Role);
    }

    private static HotelsController HotelController(AppDbContext db, int userId, string role) => SetUser(new HotelsController(db), userId, role);

    private static HotelRoomsController RoomController(AppDbContext db, int userId, string role) => SetUser(new HotelRoomsController(db), userId, role);

    private static TaxiServicesController TaxiController(AppDbContext db, int userId, string role) => SetUser(new TaxiServicesController(db), userId, role);

    private static T SetUser<T>(T controller, int userId, string role) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)],
                    "TestAuth"))
            }
        };
        return controller;
    }

    private static AppDbContext CreateDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private static AppUser User(int id, string role = UserRoles.User) => new()
    {
        Id = id,
        Name = $"User {id}",
        Email = $"user{id}@gmail.com",
        PhoneNumber = "+994501234567",
        PasswordHash = "hash",
        Role = role
    };

    private static Hotel Hotel(int id = 1, int? ownerId = null) => new()
    {
        Id = id,
        Name = id == 1 ? "Baku hotel" : "Other hotel",
        City = "Baku",
        OwnerId = ownerId
    };

    private static HotelRoom Room(int id, int hotelId, string roomType) => new()
    {
        Id = id,
        HotelId = hotelId,
        RoomType = roomType,
        Capacity = 2,
        TotalRooms = 50,
        PricePerNight = 100
    };

    private static HotelUpdateDto HotelUpdate() => new()
    {
        Name = "Updated hotel",
        City = "Baku",
        ImageUrls = []
    };

    private static HotelRoomCreateDto RoomCreate() => new()
    {
        HotelId = 1,
        RoomType = "Standard",
        Capacity = 2,
        TotalRooms = 50,
        PricePerNight = 100
    };

    private static HotelRoomUpdateDto RoomUpdate(int hotelId, string roomType) => new()
    {
        HotelId = hotelId,
        RoomType = roomType,
        Capacity = 2,
        TotalRooms = 50,
        PricePerNight = 100
    };

    private static TaxiService Taxi(int? ownerId) => new()
    {
        Id = 1,
        OwnerId = ownerId,
        CompanyName = "Baku Taxi",
        City = "Baku",
        PhoneNumber = "+994501234567",
        Description = "Airport rides",
        ImageUrl = "https://example.com/taxi.jpg",
        CarClasses = [new TaxiCarClass { Name = "Standard", PricePerKm = 1 }]
    };

    private static TaxiServiceUpdateDto TaxiUpdate(string companyName) => new()
    {
        CompanyName = companyName,
        City = "Baku",
        PhoneNumber = "+994501234567",
        Description = "Airport rides",
        ImageUrl = "https://example.com/taxi.jpg",
        CarClasses = [new TaxiCarClassInputDto { Name = "Standard", PricePerKm = 2 }]
    };
}

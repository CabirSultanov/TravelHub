using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Taxi;

public class TaxiDriversControllerTests
{
    [Fact]
    public void TaxiDriverRole_Exists() => Assert.Equal("TaxiDriver", UserRoles.TaxiDriver);

    [Theory]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task Administrator_CanAssignRegularUserAsDriver(string role)
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1));
        db.Users.Add(User(2));
        await db.SaveChangesAsync();

        var result = await Controller(db, 9, role).AssignDriver(1, 2, default);

        Assert.IsType<NoContentResult>(result);
        var driver = await db.Users.FindAsync(2);
        Assert.Equal(UserRoles.TaxiDriver, driver!.Role);
        Assert.Equal(1, driver.TaxiServiceId);
    }

    [Fact]
    public async Task TaxiOwner_CanManageDriversOfOwnTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1, ownerId: 1));
        db.Users.Add(User(2));
        await db.SaveChangesAsync();

        var controller = Controller(db, 1, UserRoles.TaxiOwner);
        Assert.IsType<NoContentResult>(await controller.AssignDriver(1, 2, default));
        Assert.IsType<NoContentResult>(await controller.RemoveDriver(1, 2, default));

        var user = await db.Users.FindAsync(2);
        Assert.Equal(UserRoles.User, user!.Role);
        Assert.Null(user.TaxiServiceId);
    }

    [Fact]
    public async Task Candidates_IncludeUnblockedUsersAndExcludeBlockedUsers()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1));
        db.Users.AddRange(User(2), User(3, isBlocked: true));
        await db.SaveChangesAsync();

        var candidates = (await Controller(db, 9, UserRoles.Admin).GetCandidates(1, null, default)).Value;

        Assert.NotNull(candidates);
        Assert.Contains(candidates!, user => user.Id == 2);
        Assert.DoesNotContain(candidates!, user => user.Id == 3);
    }

    [Theory]
    [InlineData(UserRoles.TaxiOwner)]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task Manager_CannotAssignBlockedUserAsDriver(string role)
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1, ownerId: role == UserRoles.TaxiOwner ? 1 : null));
        db.Users.Add(User(2, isBlocked: true));
        await db.SaveChangesAsync();

        var result = await Controller(db, role == UserRoles.TaxiOwner ? 1 : 9, role).AssignDriver(1, 2, default);

        var error = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Blocked users cannot be assigned as taxi drivers.", error.Value);
        var user = await db.Users.FindAsync(2);
        Assert.Equal(UserRoles.User, user!.Role);
        Assert.Null(user.TaxiServiceId);
    }

    [Fact]
    public async Task TaxiOwner_CannotManageAnotherTaxiServicesDrivers()
    {
        await using var db = CreateDb();
        db.TaxiServices.AddRange(Taxi(1, ownerId: 1), Taxi(2, ownerId: 2));
        db.Users.Add(User(3));
        await db.SaveChangesAsync();

        var result = await Controller(db, 1, UserRoles.TaxiOwner).AssignDriver(2, 3, default);

        Assert.IsType<ForbidResult>(result);
        Assert.Equal(UserRoles.User, (await db.Users.FindAsync(3))!.Role);
    }

    [Fact]
    public async Task DriverCannotBeSilentlyMovedToAnotherTaxiService()
    {
        await using var db = CreateDb();
        db.TaxiServices.AddRange(Taxi(1), Taxi(2));
        db.Users.Add(User(3, UserRoles.TaxiDriver, taxiServiceId: 1));
        await db.SaveChangesAsync();

        var result = await Controller(db, 9, UserRoles.Admin).AssignDriver(2, 3, default);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(1, (await db.Users.FindAsync(3))!.TaxiServiceId);
    }

    [Theory]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    [InlineData(UserRoles.HotelOwner)]
    [InlineData(UserRoles.TaxiOwner)]
    public async Task PrivilegedUsers_CannotBeConvertedToDrivers(string targetRole)
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1));
        db.Users.Add(User(3, targetRole));
        await db.SaveChangesAsync();

        var result = await Controller(db, 9, UserRoles.Admin).AssignDriver(1, 3, default);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(targetRole, (await db.Users.FindAsync(3))!.Role);
    }

    [Fact]
    public async Task TaxiDriver_CannotManageDrivers()
    {
        await using var db = CreateDb();
        db.TaxiServices.Add(Taxi(1));
        db.Users.Add(User(2));
        await db.SaveChangesAsync();

        var result = await Controller(db, 7, UserRoles.TaxiDriver).AssignDriver(1, 2, default);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public void ProfileUpdateRequest_CannotSetRoleOrTaxiServiceId()
    {
        Assert.Null(typeof(UpdateProfileRequestDto).GetProperty("Role"));
        Assert.Null(typeof(UpdateProfileRequestDto).GetProperty("TaxiServiceId"));
    }

    private static TaxiDriversController Controller(AppDbContext db, int userId, string role)
    {
        var controller = new TaxiDriversController(db);
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

    private static TaxiService Taxi(int id, int? ownerId = null) => new()
    {
        Id = id,
        OwnerId = ownerId,
        CompanyName = $"Taxi {id}",
        City = "Baku",
        PhoneNumber = "+994501234567",
        Description = "Taxi service",
        ImageUrl = "https://example.com/taxi.jpg"
    };

    private static AppUser User(int id, string role = UserRoles.User, int? taxiServiceId = null, bool isBlocked = false) => new()
    {
        Id = id,
        Name = $"User {id}",
        Email = $"user{id}@gmail.com",
        PhoneNumber = "+994501234567",
        PasswordHash = "hash",
        Role = role,
        TaxiServiceId = taxiServiceId,
        IsBlocked = isBlocked
    };
}

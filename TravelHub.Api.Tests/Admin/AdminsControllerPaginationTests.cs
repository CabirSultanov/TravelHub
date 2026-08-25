using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Admin;

public class AdminsControllerPaginationTests
{
    [Fact]
    public async Task GetRegularUsers_ReturnsFirstPageWithTotals()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 12, admins: 1, superAdmins: 1);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(10, response.Items.Count);
        Assert.Equal(12, response.TotalItems);
        Assert.Equal(2, response.TotalPages);
        Assert.Equal(1, response.Page);
        Assert.All(response.Items, user => Assert.Equal(UserRoles.User, user.Role));
    }

    [Fact]
    public async Task GetRegularUsers_ReturnsSecondPageRemainingUsers()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 12);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 2, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(2, response.Items.Count);
        Assert.Equal(2, response.Page);
    }

    [Fact]
    public async Task GetRegularUsers_ExcludesAdminsAndSuperAdmins()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 3, admins: 2, superAdmins: 1);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(3, response.TotalItems);
        Assert.All(response.Items, user => Assert.Equal(UserRoles.User, user.Role));
    }

    [Fact]
    public async Task GetRegularUsers_UsesStableIdOrdering()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 5);
        await db.SaveChangesAsync();
        var expectedIds = await db.Users
            .Where(user => user.Role == UserRoles.User)
            .OrderBy(user => user.Id)
            .Select(user => user.Id)
            .ToListAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(expectedIds, response.Items.Select(user => user.Id));
    }

    [Fact]
    public async Task GetRegularUsers_NormalizesInvalidPage()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 3);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 0, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(1, response.Page);
        Assert.Equal(3, response.Items.Count);
    }

    [Fact]
    public async Task GetRegularUsers_WhenRequestedPageIsTooLarge_UsesLastPage()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 21);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 9, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(3, response.Page);
        Assert.Equal(3, response.TotalPages);
        Assert.Single(response.Items);
    }

    [Fact]
    public async Task GetRegularUsers_WithZeroUsers_ReturnsEmptyFirstPage()
    {
        await using var db = CreateDb();
        var controller = CreateController(db);

        var result = await controller.GetRegularUsers(page: 2, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Empty(response.Items);
        Assert.Equal(1, response.Page);
        Assert.Equal(0, response.TotalItems);
        Assert.Equal(0, response.TotalPages);
    }

    private static AdminsController CreateController(AppDbContext db) =>
        new(db, new PasswordHasher<AppUser>());

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static void SeedUsers(AppDbContext db, int regularUsers = 0, int admins = 0, int superAdmins = 0)
    {
        AddUsers(db, regularUsers, UserRoles.User);
        AddUsers(db, admins, UserRoles.Admin);
        AddUsers(db, superAdmins, UserRoles.SuperAdmin);
    }

    private static void AddUsers(AppDbContext db, int count, string role)
    {
        for (var index = 1; index <= count; index++)
        {
            db.Users.Add(new AppUser
            {
                Name = $"{role} {index}",
                Email = $"{role.ToLowerInvariant()}{index}@gmail.com",
                PhoneNumber = $"+99450123{index:0000}",
                PasswordHash = "hash",
                Role = role
            });
        }
    }
}

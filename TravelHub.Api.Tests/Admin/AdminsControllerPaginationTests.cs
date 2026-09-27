using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Admin;

public class AdminsControllerPaginationTests
{
    [Fact]
    public async Task GetUsers_ReturnsFirstPageWithTotals()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 12, admins: 1, superAdmins: 1);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(10, response.Items.Count);
        Assert.Equal(14, response.TotalItems);
        Assert.Equal(2, response.TotalPages);
        Assert.Equal(1, response.Page);
    }

    [Fact]
    public async Task GetUsers_ReturnsSecondPageRemainingUsers()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 12);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 2, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(2, response.Items.Count);
        Assert.Equal(2, response.Page);
    }

    [Fact]
    public async Task GetUsers_IncludesEveryAccountRole()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 3, admins: 2, superAdmins: 1);
        AddUsers(db, 1, UserRoles.TaxiOwner);
        AddUsers(db, 1, UserRoles.TaxiDriver);
        AddUsers(db, 1, UserRoles.HotelOwner);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(9, response.TotalItems);
        Assert.Equal(new[] { UserRoles.User, UserRoles.Admin, UserRoles.SuperAdmin, UserRoles.HotelOwner, UserRoles.TaxiOwner, UserRoles.TaxiDriver }.Order(), response.Items.Select(user => user.Role).Distinct().Order());
    }

    [Fact]
    public async Task GetUsers_OrdersByNameThenEmail()
    {
        await using var db = CreateDb();
        db.Users.AddRange(
            CreateUser("Zoe", "zoe@gmail.com"),
            CreateUser("alice", "second@gmail.com"),
            CreateUser("Alice", "first@gmail.com"));
        await db.SaveChangesAsync();
        var expectedIds = await db.Users
            .Where(user => user.Role == UserRoles.User)
            .OrderBy(user => user.Name)
            .ThenBy(user => user.Email)
            .Select(user => user.Id)
            .ToListAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 1, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(expectedIds, response.Items.Select(user => user.Id));
    }

    [Fact]
    public async Task GetUsers_FiltersByNameBeforePagination()
    {
        await using var db = CreateDb();
        db.Users.AddRange(
            CreateUser("John Zebra", "zebra@gmail.com"),
            CreateUser("john Alpha", "alpha@gmail.com"),
            CreateUser("Mariam", "mariam@gmail.com"));
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(search: "  JOHN  ", page: 1, pageSize: 1);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(2, response.TotalItems);
        Assert.Single(response.Items);
        Assert.Equal("john Alpha", response.Items[0].Name);
    }

    [Fact]
    public async Task GetUsers_FiltersByEmailAndPhoneNumber()
    {
        await using var db = CreateDb();
        db.Users.AddRange(
            CreateUser("Ayla", "ayla@example.com", "+994501234567"),
            CreateUser("Nigar", "nigar@example.com", "+994559876543"));
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var emailResult = await controller.GetUsers(search: "AYLA@EXAMPLE", pageSize: 10);
        var phoneResult = await controller.GetUsers(search: "9876543", pageSize: 10);

        Assert.Equal("Ayla", Assert.Single(emailResult.Value!.Items).Name);
        Assert.Equal("Nigar", Assert.Single(phoneResult.Value!.Items).Name);
    }

    [Fact]
    public async Task GetUsers_NormalizesInvalidPage()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 3);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 0, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(1, response.Page);
        Assert.Equal(3, response.Items.Count);
    }

    [Fact]
    public async Task GetUsers_WhenRequestedPageIsTooLarge_UsesLastPage()
    {
        await using var db = CreateDb();
        SeedUsers(db, regularUsers: 21);
        await db.SaveChangesAsync();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 9, pageSize: 10);
        Assert.NotNull(result.Value);
        var response = result.Value!;

        Assert.Equal(3, response.Page);
        Assert.Equal(3, response.TotalPages);
        Assert.Single(response.Items);
    }

    [Fact]
    public async Task GetUsers_WithZeroUsers_ReturnsEmptyFirstPage()
    {
        await using var db = CreateDb();
        var controller = CreateController(db);

        var result = await controller.GetUsers(page: 2, pageSize: 10);
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

    private static AppUser CreateUser(string name, string email, string? phoneNumber = null) => new()
    {
        Name = name,
        Email = email,
        PhoneNumber = phoneNumber ?? "+994501234567",
        PasswordHash = "hash",
        Role = UserRoles.User
    };
}

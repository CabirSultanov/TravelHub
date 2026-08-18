using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TravelHub.Api.Configuration;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Auth;

public class AuthRegistrationTests
{
    [Fact]
    public async Task Register_WithValidInput_CreatesUserAndSession()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        var result = await controller.Register(ValidRequest());

        var response = Assert.IsType<AuthResponseDto>(result.Value);
        var storedUser = await db.Users.SingleAsync();
        Assert.Equal("Jabir Sultanov", response.User.Name);
        Assert.Equal("jabir@gmail.com", storedUser.Email);
        Assert.Equal("+994501234567", storedUser.PhoneNumber);
        Assert.NotEqual("Travel123!", storedUser.PasswordHash);
        Assert.Single(await db.RefreshTokens.ToListAsync());
    }

    [Fact]
    public async Task Register_WithDuplicateExactEmail_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        await controller.Register(ValidRequest());
        var result = await controller.Register(ValidRequest());

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal("User with this email already exists.", conflict.Value);
    }

    [Fact]
    public async Task Register_WithDuplicateEmailDifferentCase_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        await controller.Register(ValidRequest(email: "Jabir@Gmail.com"));
        var result = await controller.Register(ValidRequest(email: "jabir@gmail.com"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Single(await db.Users.ToListAsync());
    }

    [Fact]
    public async Task Register_WithDuplicateEmailAfterTrim_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        await controller.Register(ValidRequest(email: " jabir@gmail.com "));
        var result = await controller.Register(ValidRequest(email: "jabir@gmail.com"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Single(await db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("1234567")]
    [InlineData("password")]
    [InlineData("PASSWORD1")]
    [InlineData("Password1")]
    [InlineData("Pass!")]
    public async Task Register_WithInvalidPassword_ReturnsBadRequest(string password)
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        var result = await controller.Register(ValidRequest(password: password));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(await db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("abc@")]
    [InlineData("@gmail.com")]
    [InlineData("abc gmail.com")]
    [InlineData("abc@gmail")]
    [InlineData("")]
    public async Task Register_WithInvalidEmail_ReturnsBadRequest(string email)
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        var result = await controller.Register(ValidRequest(email: email));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(await db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("cabir@gmil.com")]
    [InlineData("cabir@gmail.co")]
    [InlineData("cabir@yahoo.com")]
    [InlineData("cabir@outlook.com")]
    public async Task Register_WithNonGmailEmail_ReturnsBadRequest(string email)
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        var result = await controller.Register(ValidRequest(email: email));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Only Gmail addresses (@gmail.com) are allowed.", badRequest.Value);
        Assert.Empty(await db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("+995501234567")]
    [InlineData("+99450123456")]
    [InlineData("+9945012345678")]
    [InlineData("+99450abc4567")]
    public async Task Register_WithInvalidPhone_ReturnsBadRequest(string phoneNumber)
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        var result = await controller.Register(ValidRequest(phoneNumber: phoneNumber));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(await db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("+994 50 123 45 67")]
    [InlineData("+994501234567")]
    [InlineData("0501234567")]
    [InlineData("50 123 45 67")]
    public async Task Register_WithValidFormattedPhone_StoresCanonicalPhone(string phoneNumber)
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db);

        await controller.Register(ValidRequest(phoneNumber: phoneNumber));

        Assert.Equal("+994501234567", (await db.Users.SingleAsync()).PhoneNumber);
    }

    [Fact]
    public async Task CreateAdmin_WithExistingUserEmail_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var authController = CreateController(db);
        var adminController = new AdminsController(db, new PasswordHasher<AppUser>());

        await authController.Register(ValidRequest());
        var result = await adminController.CreateAdmin(ValidAdminRequest(email: "JABIR@gmail.com"));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Single(await db.Users.ToListAsync());
    }

    [Fact]
    public void AppUserEmail_HasUniqueDatabaseIndex()
    {
        using var db = CreateDbContext();

        var userEntity = db.Model.FindEntityType(typeof(AppUser));
        var emailProperty = userEntity?.FindProperty(nameof(AppUser.Email));
        var emailIndex = userEntity?.GetIndexes().SingleOrDefault(index => emailProperty is not null && index.Properties.Contains(emailProperty));

        Assert.NotNull(emailIndex);
        Assert.True(emailIndex.IsUnique);
    }

    [Fact]
    public async Task UpdateMe_WithNameOnlyPasswordFieldsEmpty_UpdatesProfileAndKeepsPassword()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var oldPasswordHash = user.PasswordHash;
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(name: "Updated Name"));

        var response = Assert.IsType<AuthUserDto>(result.Value);
        var storedUser = await db.Users.SingleAsync(user => user.Id == response.Id);
        Assert.Equal("Updated Name", response.Name);
        Assert.Equal(oldPasswordHash, storedUser.PasswordHash);
    }

    [Fact]
    public async Task UpdateMe_WithPhone_StoresCanonicalPhone()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        await controller.UpdateMe(UpdateRequest(phoneNumber: "050 765 43 21"));

        Assert.Equal("+994507654321", (await db.Users.SingleAsync(user => user.Id == 1)).PhoneNumber);
    }

    [Fact]
    public async Task UpdateMe_WithGmail_UpdatesEmail()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(email: "NEW.Email@Gmail.com"));

        var response = Assert.IsType<AuthUserDto>(result.Value);
        Assert.Equal("new.email@gmail.com", response.Email);
    }

    [Fact]
    public async Task UpdateMe_WithAnotherUsersEmail_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        await SeedUserAsync(db, id: 2, email: "other@gmail.com");
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(email: "OTHER@gmail.com"));

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal("This email is already in use.", conflict.Value);
    }

    [Fact]
    public async Task UpdateMe_WithNonGmailEmail_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(email: "cabir@yahoo.com"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Only Gmail addresses (@gmail.com) are allowed.", badRequest.Value);
    }

    [Fact]
    public async Task UpdateMe_WithValidPasswordChange_UpdatesPasswordHash()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var oldPasswordHash = user.PasswordHash;
        var controller = CreateController(db, user.Id);

        await controller.UpdateMe(UpdateRequest(
            newPassword: "NewTravel123!",
            confirmNewPassword: "NewTravel123!"));

        var storedUser = await db.Users.SingleAsync(user => user.Id == 1);
        Assert.NotEqual(oldPasswordHash, storedUser.PasswordHash);
        Assert.NotEqual(PasswordVerificationResult.Failed, new PasswordHasher<AppUser>().VerifyHashedPassword(storedUser, storedUser.PasswordHash, "NewTravel123!"));
    }

    [Fact]
    public async Task UpdateMe_WithPasswordChangeEnabledAndEmptyPasswords_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(changePassword: true));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("New password does not meet the password requirements.", badRequest.Value);
    }

    [Fact]
    public async Task UpdateMe_WithWeakNewPassword_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(
            newPassword: "weak",
            confirmNewPassword: "weak"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("New password does not meet the password requirements.", badRequest.Value);
    }

    [Fact]
    public async Task UpdateMe_WithMismatchingPasswordConfirmation_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var controller = CreateController(db, user.Id);

        var result = await controller.UpdateMe(UpdateRequest(
            newPassword: "NewTravel123!",
            confirmNewPassword: "OtherTravel123!"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Passwords do not match.", badRequest.Value);
    }

    private static AuthController CreateController(AppDbContext db, int? currentUserId = null)
    {
        var controller = new AuthController(
            db,
            new PasswordHasher<AppUser>(),
            new FakeTokenService(),
            Options.Create(new JwtOptions { RefreshTokenDays = 7 }));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = currentUserId is null
                    ? new ClaimsPrincipal()
                    : new ClaimsPrincipal(new ClaimsIdentity(
                        [
                            new Claim(ClaimTypes.NameIdentifier, currentUserId.Value.ToString()),
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

    private static RegisterRequestDto ValidRequest(
        string name = "Jabir Sultanov",
        string email = "jabir@gmail.com",
        string phoneNumber = "+994501234567",
        string password = "Travel123!") => new()
        {
            Name = name,
            Email = email,
            PhoneNumber = phoneNumber,
            Password = password
        };

    private static UpdateProfileRequestDto UpdateRequest(
        string name = "Jabir Sultanov",
        string email = "jabir@gmail.com",
        string phoneNumber = "+994501234567",
        bool changePassword = false,
        string newPassword = "",
        string confirmNewPassword = "") => new()
        {
            Name = name,
            Email = email,
            PhoneNumber = phoneNumber,
            ChangePassword = changePassword,
            NewPassword = newPassword,
            ConfirmNewPassword = confirmNewPassword
        };

    private static async Task<AppUser> SeedUserAsync(
        AppDbContext db,
        int id = 1,
        string name = "Jabir Sultanov",
        string email = "jabir@gmail.com",
        string password = "Travel123!")
    {
        var user = new AppUser
        {
            Id = id,
            Name = name,
            Email = email,
            PhoneNumber = "+994501234567",
            Role = UserRoles.User
        };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static CreateAdminRequestDto ValidAdminRequest(
        string name = "Admin User",
        string email = "admin@gmail.com",
        string phoneNumber = "+994501234568",
        string password = "Travel123!") => new()
        {
            Name = name,
            Email = email,
            PhoneNumber = phoneNumber,
            Password = password
        };

    private sealed class FakeTokenService : ITokenService
    {
        public AccessTokenResult CreateAccessToken(AppUser user) => new("access-token", DateTime.UtcNow.AddMinutes(15));

        public string CreateRefreshToken() => "refresh-token";

        public string HashRefreshToken(string token) => $"hash-{token}";
    }
}

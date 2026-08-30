using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;
using TravelHub.Api.Configuration;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Auth;

public class AuthRegistrationTests
{
    private static readonly IDataProtectionProvider TestDataProtection = new EphemeralDataProtectionProvider();

    [Fact]
    public async Task Register_WithValidInput_CreatesUnconfirmedUserAndSendsVerificationCode()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        var controller = CreateController(db, emailService: emailService);

        var result = await controller.Register(ValidRequest());

        var response = Assert.IsType<EmailConfirmationRequiredDto>(result.Value);
        var storedUser = await db.Users.SingleAsync();
        Assert.True(response.EmailConfirmationRequired);
        Assert.Equal("Jabir Sultanov", storedUser.Name);
        Assert.Equal("jabir@gmail.com", storedUser.Email);
        Assert.Equal("+994501234567", storedUser.PhoneNumber);
        Assert.NotEqual("Travel123!", storedUser.PasswordHash);
        Assert.False(storedUser.EmailConfirmed);
        Assert.NotNull(storedUser.EmailVerificationCodeHash);
        Assert.NotEqual(emailService.LastCode, storedUser.EmailVerificationCodeHash);
        Assert.Empty(await db.RefreshTokens.ToListAsync());
        Assert.Equal("jabir@gmail.com", emailService.LastEmail);
    }

    [Fact]
    public async Task VerifyEmail_WithCorrectCode_ConfirmsUserAndCreatesSession()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        var controller = CreateController(db, emailService: emailService);
        await controller.Register(ValidRequest());

        var verificationRequest = new VerifyEmailRequestDto { Email = "jabir@gmail.com", Code = emailService.LastCode! };
        var result = await CreateController(db).VerifyEmail(verificationRequest);

        Assert.IsType<AuthResponseDto>(result.Value);
        var storedUser = await db.Users.SingleAsync();
        Assert.True(storedUser.EmailConfirmed);
        Assert.Null(storedUser.EmailVerificationCodeHash);
        Assert.Single(await db.RefreshTokens.ToListAsync());

        var reuse = await CreateController(db).VerifyEmail(verificationRequest);
        Assert.IsType<ConflictObjectResult>(reuse.Result);
    }

    [Fact]
    public async Task VerifyEmail_WrongCode_LocksAfterFiveAttempts()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        await CreateController(db, emailService: emailService).Register(ValidRequest());

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var result = await CreateController(db).VerifyEmail(new VerifyEmailRequestDto { Email = "jabir@gmail.com", Code = "000000" });
            var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
            Assert.Contains(attempt == 5 ? "Too many" : "incorrect", badRequest.Value!.ToString());
        }

        var user = await db.Users.SingleAsync();
        Assert.Equal(5, user.EmailVerificationAttemptCount);
        Assert.False(user.EmailConfirmed);
    }

    [Fact]
    public async Task VerifyEmail_RejectsExpiredCode()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        await CreateController(db, emailService: emailService).Register(ValidRequest());
        var user = await db.Users.SingleAsync();
        user.EmailVerificationExpiresAt = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();

        var result = await CreateController(db).VerifyEmail(new VerifyEmailRequestDto { Email = user.Email, Code = emailService.LastCode! });

        Assert.Contains("expired", Assert.IsType<BadRequestObjectResult>(result.Result).Value!.ToString());
    }

    [Fact]
    public async Task ResendEmailConfirmation_ReplacesCodeAndEnforcesCooldown()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        await CreateController(db, emailService: emailService).Register(ValidRequest());
        var firstCode = emailService.LastCode;

        var cooldown = await CreateController(db).ResendEmailConfirmation(new ResendEmailConfirmationRequestDto { Email = "jabir@gmail.com" });
        Assert.IsType<ObjectResult>(cooldown.Result);
        Assert.Equal(StatusCodes.Status429TooManyRequests, ((ObjectResult)cooldown.Result!).StatusCode);

        var user = await db.Users.SingleAsync();
        user.EmailVerificationSentAt = DateTime.UtcNow.AddMinutes(-2);
        await db.SaveChangesAsync();
        var resend = await CreateController(db, emailService: emailService).ResendEmailConfirmation(new ResendEmailConfirmationRequestDto { Email = user.Email });
        Assert.IsType<EmailConfirmationRequiredDto>(resend.Value);
        Assert.NotEqual(firstCode, emailService.LastCode);

        var oldCode = await CreateController(db).VerifyEmail(new VerifyEmailRequestDto { Email = user.Email, Code = firstCode! });
        Assert.IsType<BadRequestObjectResult>(oldCode.Result);
    }

    [Fact]
    public async Task Login_UnconfirmedUserReturnsConfirmationRequired_ButConfirmedUserCanLogIn()
    {
        await using var db = CreateDbContext();
        var emailService = new FakeEmailService();
        await CreateController(db, emailService: emailService).Register(ValidRequest());

        var unconfirmedLogin = await CreateController(db).Login(new LoginRequestDto { Email = "jabir@gmail.com", Password = "Travel123!" });
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(unconfirmedLogin.Result).StatusCode);
        Assert.Empty(await db.RefreshTokens.ToListAsync());

        var user = await db.Users.SingleAsync();
        user.EmailConfirmed = true;
        await db.SaveChangesAsync();
        var confirmedLogin = await CreateController(db).Login(new LoginRequestDto { Email = user.Email, Password = "Travel123!" });
        Assert.IsType<AuthResponseDto>(confirmedLogin.Value);
    }

    [Fact]
    public async Task Refresh_ReusesTheSameReplacementTokenDuringTheGracePeriod()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = "hash-refresh-token-0",
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        });
        await db.SaveChangesAsync();

        var firstController = CreateController(db);
        SetRefreshTokenCookie(firstController, "refresh-token-0");
        var firstResult = await firstController.Refresh();
        var firstCookie = GetRefreshTokenCookie(firstController);

        var secondController = CreateController(db);
        SetRefreshTokenCookie(secondController, "refresh-token-0");
        var secondResult = await secondController.Refresh();

        Assert.IsType<AuthResponseDto>(firstResult.Value);
        Assert.IsType<AuthResponseDto>(secondResult.Value);
        Assert.Equal(firstCookie, GetRefreshTokenCookie(secondController));
        Assert.Equal(2, await db.RefreshTokens.CountAsync());
        var revokedToken = await db.RefreshTokens.SingleAsync(token => token.TokenHash == "hash-refresh-token-0");
        Assert.NotNull(revokedToken.ProtectedReplacementToken);
    }

    [Fact]
    public async Task Refresh_RejectsAReplacedTokenAfterTheGracePeriod()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = "hash-refresh-token-0",
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            RevokedAt = DateTime.UtcNow.AddSeconds(-11),
            ReplacedByTokenHash = "hash-refresh-token-1",
            ProtectedReplacementToken = "not-used-after-grace"
        });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        SetRefreshTokenCookie(controller, "refresh-token-0");

        var result = await controller.Refresh();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task Refresh_RejectsAReplacedTokenWithCorruptedProtectedValue()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = "hash-refresh-token-0",
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            RevokedAt = DateTime.UtcNow,
            ReplacedByTokenHash = "hash-refresh-token-1",
            ProtectedReplacementToken = "corrupted"
        });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        SetRefreshTokenCookie(controller, "refresh-token-0");

        var result = await controller.Refresh();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task Refresh_RejectsBlockedUsers()
    {
        await using var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        user.IsBlocked = true;
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = "hash-refresh-token-0",
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        SetRefreshTokenCookie(controller, "refresh-token-0");

        var result = await controller.Refresh();

        Assert.IsType<UnauthorizedResult>(result.Result);
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

    private static AuthController CreateController(AppDbContext db, int? currentUserId = null, FakeEmailService? emailService = null)
    {
        var controller = new AuthController(
            db,
            new PasswordHasher<AppUser>(),
            new FakeTokenService(),
            Options.Create(new JwtOptions { RefreshTokenDays = 7 }),
            TestDataProtection,
            emailService ?? new FakeEmailService(),
            NullLogger<AuthController>.Instance);

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
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }

    private static void SetRefreshTokenCookie(AuthController controller, string token) =>
        controller.HttpContext.Request.Headers.Cookie = $"TravelHub.RefreshToken={token}";

    private static string GetRefreshTokenCookie(AuthController controller)
    {
        var setCookie = Assert.Single(controller.HttpContext.Response.Headers.SetCookie) ?? throw new InvalidOperationException("Refresh cookie was not set.");
        var cookieParts = setCookie.Split(';', 2)[0].Split('=', 2);
        return cookieParts.Length == 2 ? cookieParts[1] : throw new InvalidOperationException("Refresh cookie is invalid.");
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
        private int refreshTokenNumber;

        public AccessTokenResult CreateAccessToken(AppUser user) => new("access-token", DateTime.UtcNow.AddMinutes(15));

        public string CreateRefreshToken() => $"refresh-token-{++refreshTokenNumber}";

        public string HashRefreshToken(string token) => $"hash-{token}";
    }

    private sealed class FakeEmailService : IEmailService
    {
        public string? LastEmail { get; private set; }
        public string? LastCode { get; private set; }

        public Task SendEmailConfirmationAsync(string email, string name, string code, CancellationToken cancellationToken = default)
        {
            LastEmail = email;
            LastCode = code;
            return Task.CompletedTask;
        }
    }
}

using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Auth;

public class PasswordRecoveryTests
{
    private const string Code = "123456";
    private const string OldPassword = "OldPassword1!";
    private const string NewPassword = "NewPassword2!";
    private const string Grant = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    private readonly PasswordHasher<AppUser> hasher = new();

    [Fact]
    public async Task CompleteFlow_RequiresEmailCode_ChangesPasswordOnce_RevokesRefreshIncludingReplay()
    {
        await using var db = CreateDb();
        var user = await Seed(db);
        var mail = new FakeEmail();
        var controller = Controller(db, mail);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "old", ExpiresAt = DateTime.UtcNow.AddDays(1), ReplacedByTokenHash = "replacement", ProtectedReplacementToken = "protected", RevokedAt = DateTime.UtcNow });
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "current", ExpiresAt = DateTime.UtcNow.AddDays(1) });
        await db.SaveChangesAsync();

        var requested = await controller.RequestCode(new() { Email = "  PERSON@gmail.com " });
        Assert.IsType<PasswordCodeSentDto>(requested.Value);
        Assert.Matches("^[0-9]{6}$", mail.Code!);
        Assert.NotEqual(mail.Code, (await db.PasswordRecoveries.SingleAsync()).CodeHash);
        Assert.True(Matches(user, OldPassword)); // Requesting recovery does not change the password.

        Assert.IsType<BadRequestObjectResult>(await controller.ResetPassword(Reset()));
        var verified = await controller.VerifyCode(new() { Email = user.Email, Code = mail.Code! });
        var grant = Assert.IsType<PasswordCodeVerifiedDto>(verified.Value);
        Assert.Equal(64, grant.ResetToken.Length);
        Assert.NotEqual(grant.ResetToken, (await db.PasswordRecoveries.SingleAsync()).ResetTokenHash);
        Assert.IsType<BadRequestObjectResult>((await controller.VerifyCode(new() { Email = user.Email, Code = mail.Code! })).Result);
        Assert.IsType<NoContentResult>(await controller.ResetPassword(Reset(token: grant.ResetToken)));
        Assert.False(Matches(user, OldPassword));
        Assert.True(Matches(user, NewPassword));
        Assert.Equal(1, mail.Notifications);
        Assert.All(await db.RefreshTokens.ToListAsync(), token =>
        {
            Assert.NotNull(token.RevokedAt);
            Assert.Null(token.ReplacedByTokenHash);
            Assert.Null(token.ProtectedReplacementToken);
        });
        Assert.IsType<BadRequestObjectResult>(await controller.ResetPassword(Reset(token: grant.ResetToken)));
        Assert.Null(controller.Response.Headers.SetCookie.FirstOrDefault());
    }

    [Fact]
    public async Task Request_DoesNotRevealUnknownBlockedOrDeliveryFailure_EnforcesCooldown()
    {
        await using var db = CreateDb();
        var user = await Seed(db);
        var mail = new FakeEmail { FailDelivery = true };
        var controller = Controller(db, mail);
        var known = await controller.RequestCode(new() { Email = user.Email });
        var unknown = await controller.RequestCode(new() { Email = "missing@gmail.com" });
        var cooldown = await controller.RequestCode(new() { Email = user.Email });
        user.IsBlocked = true;
        await db.SaveChangesAsync();
        var blocked = await controller.RequestCode(new() { Email = user.Email });
        Assert.Equal(known.Value, unknown.Value);
        Assert.Equal(known.Value, blocked.Value);
        Assert.Equal(known.Value, cooldown.Value);
        Assert.Equal(1, mail.SendAttempts);
        Assert.Single(await db.PasswordRecoveries.ToListAsync());
        Assert.True(Matches(user, OldPassword));
    }

    [Fact]
    public async Task Resend_InvalidatesPreviousGrantAndCode()
    {
        await using var db = CreateDb();
        await Seed(db, challenge: true);
        var previous = await db.PasswordRecoveries.SingleAsync();
        previous.RequestedAt = DateTime.UtcNow.AddMinutes(-2);
        previous.ResetTokenHash = Hash(Grant);
        var oldCodeHash = previous.CodeHash;
        await db.SaveChangesAsync();
        var mail = new FakeEmail();
        await Controller(db, mail).RequestCode(new() { Email = "person@gmail.com" });
        Assert.Null(previous.ResetTokenHash);
        Assert.Equal(0, previous.AttemptCount);
        Assert.NotEqual(oldCodeHash, previous.CodeHash);
        Assert.Equal(PasswordVerificationResult.Success, hasher.VerifyHashedPassword(previous.User, previous.CodeHash!, mail.Code!));
        Assert.IsType<BadRequestObjectResult>(await Controller(db).ResetPassword(Reset()));
    }

    [Fact]
    public async Task FiveWrongCodes_InvalidateChallenge_WithoutBlockingAccount()
    {
        await using var db = CreateDb();
        var user = await Seed(db, challenge: true);
        var controller = Controller(db);
        for (var attempt = 0; attempt < 5; attempt++)
            Assert.IsType<BadRequestObjectResult>((await controller.VerifyCode(new() { Email = user.Email, Code = "000000" })).Result);
        Assert.IsType<BadRequestObjectResult>((await controller.VerifyCode(new() { Email = user.Email, Code = Code })).Result);
        Assert.Equal(5, (await db.PasswordRecoveries.SingleAsync()).AttemptCount);
        Assert.False(user.IsBlocked);
        Assert.True(Matches(user, OldPassword));
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("blocked")]
    [InlineData("password-changed")]
    [InlineData("email-changed")]
    public async Task InvalidatedChallenge_CannotVerifyOrReset(string reason)
    {
        await using var db = CreateDb();
        var user = await Seed(db, challenge: true);
        var recovery = await db.PasswordRecoveries.SingleAsync();
        recovery.ResetTokenHash = Hash(Grant);
        if (reason == "expired") recovery.ExpiresAt = DateTime.UtcNow.AddSeconds(-1);
        if (reason == "blocked") user.IsBlocked = true;
        if (reason == "password-changed") user.PasswordHash = hasher.HashPassword(user, "AnotherPassword3!");
        if (reason == "email-changed") user.Email = "changed@gmail.com";
        await db.SaveChangesAsync();
        var controller = Controller(db);
        Assert.IsType<BadRequestObjectResult>((await controller.VerifyCode(new() { Email = user.Email, Code = Code })).Result);
        Assert.IsType<BadRequestObjectResult>(await controller.ResetPassword(Reset(email: user.Email)));
        Assert.False(Matches(user, NewPassword));
    }

    [Theory]
    [InlineData(UserRoles.User)]
    [InlineData(UserRoles.TaxiDriver)]
    [InlineData(UserRoles.TaxiOwner)]
    [InlineData(UserRoles.HotelOwner)]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    public async Task Reset_PreservesRoleAndEmailConfirmation(string role)
    {
        await using var db = CreateDb();
        var user = await Seed(db, challenge: true);
        user.Role = role;
        user.EmailConfirmed = false;
        var recovery = await db.PasswordRecoveries.SingleAsync();
        recovery.CodeHash = null;
        recovery.ResetTokenHash = Hash(Grant);
        await db.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await Controller(db).ResetPassword(Reset()));
        Assert.Equal(role, user.Role);
        Assert.False(user.EmailConfirmed);
    }

    [Theory]
    [InlineData("short", "short")]
    [InlineData("withoutuppercase1!", "withoutuppercase1!")]
    [InlineData("NoNumber!", "NoNumber!")]
    [InlineData("NoSpecial1", "NoSpecial1")]
    [InlineData(NewPassword, "DifferentPassword3!")]
    public async Task InvalidPassword_DoesNotConsumeGrant(string password, string confirmation)
    {
        await using var db = CreateDb();
        var user = await Seed(db, challenge: true);
        var recovery = await db.PasswordRecoveries.SingleAsync();
        recovery.ResetTokenHash = Hash(Grant);
        await db.SaveChangesAsync();
        var request = Reset();
        request.NewPassword = password;
        request.ConfirmNewPassword = confirmation;
        Assert.IsType<BadRequestObjectResult>(await Controller(db).ResetPassword(request));
        Assert.NotNull(recovery.ResetTokenHash);
        Assert.True(Matches(user, OldPassword));
    }

    [Fact]
    public async Task ConcurrentCodeVerification_OnlyOneGrantIsIssued()
    {
        var options = Options();
        await using var first = new AppDbContext(options);
        await Seed(first, challenge: true);
        await using var second = new AppDbContext(options);
        await second.PasswordRecoveries.Include(r => r.User).LoadAsync();
        Assert.IsType<PasswordCodeVerifiedDto>((await Controller(first).VerifyCode(new() { Email = "person@gmail.com", Code = Code })).Value);
        Assert.IsType<ConflictObjectResult>((await Controller(second).VerifyCode(new() { Email = "person@gmail.com", Code = Code })).Result);
    }

    [Fact]
    public void Recovery_IsRateLimited_AndSecretsAreNotCacheable()
    {
        Assert.NotNull(Attribute.GetCustomAttribute(typeof(PasswordRecoveryController), typeof(EnableRateLimitingAttribute)));
        Assert.True(((ResponseCacheAttribute)Attribute.GetCustomAttribute(typeof(PasswordRecoveryController), typeof(ResponseCacheAttribute))!).NoStore);
        var invalid = Reset(token: "123456");
        Assert.False(Validator.TryValidateObject(invalid, new ValidationContext(invalid), [], true));
    }

    private bool Matches(AppUser user, string password) => hasher.VerifyHashedPassword(user, user.PasswordHash, password) != PasswordVerificationResult.Failed;
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static DbContextOptions<AppDbContext> Options() => new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options;
    private static AppDbContext CreateDb() => new(Options());
    private static PasswordRecoveryController Controller(AppDbContext db, FakeEmail? mail = null) =>
        new(db, new PasswordHasher<AppUser>(), mail ?? new FakeEmail(), NullLogger<PasswordRecoveryController>.Instance)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
    private async Task<AppUser> Seed(AppDbContext db, bool challenge = false)
    {
        var user = new AppUser { Email = "person@gmail.com", Name = "Test Person", PhoneNumber = "+994500000000" };
        user.PasswordHash = hasher.HashPassword(user, OldPassword);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        if (challenge)
        {
            db.PasswordRecoveries.Add(new PasswordRecovery { UserId = user.Id, CodeHash = hasher.HashPassword(user, Code), CredentialHash = Hash($"{user.Email}\n{user.PasswordHash}"), RequestedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddMinutes(10) });
            await db.SaveChangesAsync();
        }
        return user;
    }
    private static ResetPasswordRequestDto Reset(string token = Grant, string email = "person@gmail.com") =>
        new() { Email = email, ResetToken = token, NewPassword = NewPassword, ConfirmNewPassword = NewPassword };
    private sealed class FakeEmail : IEmailService
    {
        public string? Code { get; private set; }
        public int Notifications { get; private set; }
        public int SendAttempts { get; private set; }
        public bool FailDelivery { get; init; }
        public Task SendEmailConfirmationAsync(string email, string name, string code, CancellationToken cancellationToken = default) => throw new InvalidOperationException("Recovery must not use registration codes.");
        public Task SendPasswordRecoveryAsync(string email, string name, string code, CancellationToken cancellationToken = default)
        {
            Code = code;
            SendAttempts++;
            return FailDelivery ? Task.FromException(new InvalidOperationException("Test SMTP failure")) : Task.CompletedTask;
        }
        public Task SendPasswordChangedAsync(string email, string name, CancellationToken cancellationToken = default)
        {
            Notifications++;
            return Task.CompletedTask;
        }
    }
}

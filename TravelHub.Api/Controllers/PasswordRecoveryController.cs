using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/auth")]
[EnableRateLimiting("password-recovery")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PasswordRecoveryController(
    AppDbContext db,
    PasswordHasher<AppUser> passwordHasher,
    IEmailService emailService,
    ILogger<PasswordRecoveryController> logger) : ControllerBase
{
    internal const int MaximumAttempts = 5;
    internal static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);
    private const string CodeError = "Invalid or expired code. Request a new code if needed.";
    private const string TokenError = "This recovery session has expired or was already used. Please request a new code.";
    private const string SentMessage = "If an eligible account exists for this email, a recovery code will arrive shortly. Check your inbox and spam folder.";

    [HttpPost("forgot-password")]
    public async Task<ActionResult<PasswordCodeSentDto>> RequestCode(ForgotPasswordRequestDto request)
    {
        if (!AuthController.IsValidEmail(request.Email, out var error)) return BadRequest(error);

        // SMTP has a four-second budget; pad every valid-email response to five
        // seconds so delivery time, cooldown and account existence are not exposed.
        var responseDelay = Task.Delay(TimeSpan.FromSeconds(5), HttpContext.RequestAborted);
        try
        {
            await PrepareAndSendCode(request.Email);
        }
        finally
        {
            await responseDelay;
        }
        return new PasswordCodeSentDto(SentMessage);
    }

    private async Task PrepareAndSendCode(string email)
    {
        var normalized = AuthController.NormalizeEmail(email);
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(user => user.Email == normalized);
        var now = DateTime.UtcNow;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        // Hash even for an unknown/blocked account to keep the expensive work uniform.
        var codeHash = passwordHasher.HashPassword(user ?? new AppUser(), code);
        if (user is null || user.IsBlocked) return;

        var recovery = await db.PasswordRecoveries.FindAsync(user.Id);
        if (recovery is not null && recovery.RequestedAt.AddMinutes(1) > now) return;
        if (recovery is null)
        {
            recovery = new PasswordRecovery { UserId = user.Id };
            db.PasswordRecoveries.Add(recovery);
        }
        recovery.CodeHash = codeHash;
        recovery.ResetTokenHash = null;
        recovery.CredentialHash = GetCredentialHash(user);
        recovery.RequestedAt = now;
        recovery.ExpiresAt = now.Add(CodeLifetime);
        recovery.AttemptCount = 0;
        recovery.Version = Guid.NewGuid();
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return; // Another request already issued a code.
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return; // SQL Server unique-key conflict on simultaneous first requests.
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(HttpContext.RequestAborted);
        timeout.CancelAfter(TimeSpan.FromSeconds(4));
        try
        {
            await emailService.SendPasswordRecoveryAsync(user.Email, user.Name, code, timeout.Token);
        }
        catch (Exception)
        {
            // Do not reveal account existence or log codes, tokens, mail bodies or SMTP credentials.
            logger.LogWarning("Password recovery email delivery failed. Check the mail service configuration and availability.");
        }
    }

    [HttpPost("verify-password-code")]
    public async Task<ActionResult<PasswordCodeVerifiedDto>> VerifyCode(VerifyPasswordCodeRequestDto request)
    {
        if (!AuthController.IsValidEmail(request.Email, out var error)) return BadRequest(error);
        if (request.Code.Length != 6 || request.Code.Any(c => c is < '0' or > '9')) return BadRequest(CodeError);
        var recovery = await LoadRecovery(request.Email);
        var now = DateTime.UtcNow;
        if (!IsCurrent(recovery, now) || recovery!.CodeHash is null || recovery.AttemptCount >= MaximumAttempts)
            return BadRequest(CodeError);

        recovery.AttemptCount++;
        recovery.Version = Guid.NewGuid();
        var valid = passwordHasher.VerifyHashedPassword(recovery.User, recovery.CodeHash, request.Code) != PasswordVerificationResult.Failed;
        string? token = null;
        if (valid)
        {
            token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            recovery.CodeHash = null;
            recovery.ResetTokenHash = Hash(token);
            recovery.ExpiresAt = now.Add(CodeLifetime);
        }
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("The recovery request changed. Please request a new code.");
        }
        return token is null ? BadRequest(CodeError) : new PasswordCodeVerifiedDto(token, recovery.ExpiresAt);
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request)
    {
        if (!AuthController.IsValidEmail(request.Email, out var error)) return BadRequest(error);
        if (!AuthController.IsValidPassword(request.NewPassword, out error)) return BadRequest(error);
        if (request.NewPassword != request.ConfirmNewPassword) return BadRequest("Passwords do not match.");
        if (request.ResetToken.Length != 64) return BadRequest(TokenError);

        // Consume the grant, update the password and revoke refresh sessions together.
        // Serializable also protects against a simultaneous profile password change/refresh.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var recovery = await LoadRecovery(request.Email);
        var now = DateTime.UtcNow;
        if (!IsCurrent(recovery, now) || recovery!.ResetTokenHash is null
            || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(recovery.ResetTokenHash), Encoding.ASCII.GetBytes(Hash(request.ResetToken))))
            return BadRequest(TokenError);

        recovery.User.PasswordHash = passwordHasher.HashPassword(recovery.User, request.NewPassword);
        recovery.CodeHash = null;
        recovery.ResetTokenHash = null;
        recovery.ExpiresAt = now;
        recovery.Version = Guid.NewGuid();
        var sessions = await db.RefreshTokens.Where(token => token.UserId == recovery.UserId && token.ExpiresAt > now).ToListAsync();
        // Existing access JWTs retain their configured expiry; revocation prevents renewal.
        foreach (var session in sessions)
        {
            session.RevokedAt = now;
            session.ReplacedByTokenHash = null;
            session.ProtectedReplacementToken = null;
        }
        try
        {
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(TokenError);
        }

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        try
        {
            await emailService.SendPasswordChangedAsync(recovery.User.Email, recovery.User.Name, timeout.Token);
        }
        catch (Exception)
        {
            logger.LogWarning("Password changed successfully, but the notification email could not be delivered.");
        }
        return NoContent(); // The user signs in normally; no login or role/email-confirmation changes.
    }

    private Task<PasswordRecovery?> LoadRecovery(string email)
    {
        var normalized = AuthController.NormalizeEmail(email);
        return db.PasswordRecoveries.Include(recovery => recovery.User).SingleOrDefaultAsync(recovery => recovery.User.Email == normalized);
    }

    private static bool IsCurrent(PasswordRecovery? recovery, DateTime now) =>
        recovery is not null && !recovery.User.IsBlocked && recovery.ExpiresAt > now
        && recovery.CredentialHash == GetCredentialHash(recovery.User);

    internal static string GetCredentialHash(AppUser user) => Hash($"{user.Email}\n{user.PasswordHash}");
    internal static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

using System.Data;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TravelHub.Api.Configuration;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    PasswordHasher<AppUser> passwordHasher,
    ITokenService tokenService,
    IOptions<JwtOptions> jwtOptions,
    IDataProtectionProvider dataProtectionProvider) : ControllerBase
{
    private const string AzerbaijanPhonePrefix = "+994";
    private const int AzerbaijanPhoneDigitCount = 9;
    private const string RefreshTokenCookieName = "TravelHub.RefreshToken";
    private const string RefreshTokenCookiePath = "/api/auth";
    private const string RefreshTokenProtectorPurpose = "TravelHub.Auth.RefreshToken.Replacement.v1";
    private static readonly TimeSpan RefreshReplayGracePeriod = TimeSpan.FromSeconds(10);
    private readonly IDataProtector refreshTokenProtector = dataProtectionProvider.CreateProtector(RefreshTokenProtectorPurpose);

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterRequestDto request)
    {
        if (!TryValidateRegistration(request, out var name, out var email, out var phoneNumber, out var error))
        {
            return BadRequest(error);
        }

        if (await db.Users.AnyAsync(user => user.Email == email))
        {
            return Conflict("User with this email already exists.");
        }

        var user = new AppUser
        {
            Name = name,
            Email = email,
            PhoneNumber = phoneNumber,
            Role = UserRoles.User
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsUniqueEmailConflict(exception))
        {
            return Conflict("User with this email already exists.");
        }

        return await CreateSessionAsync(user);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginRequestDto request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(user => user.Email == email);

        if (user is null)
        {
            return Unauthorized("Invalid email or password.");
        }

        if (user.IsBlocked)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "User is blocked.");
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);

        if (result == PasswordVerificationResult.Failed)
        {
            return Unauthorized("Invalid email or password.");
        }

        return await CreateSessionAsync(user);
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh()
    {
        var rawRefreshToken = Request.Cookies[RefreshTokenCookieName];

        if (string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            return Unauthorized();
        }

        var tokenHash = tokenService.HashRefreshToken(rawRefreshToken);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var refreshToken = await db.RefreshTokens
            .Include(token => token.User)
            .SingleOrDefaultAsync(token => token.TokenHash == tokenHash);
        var now = DateTime.UtcNow;

        if (refreshToken is null
            || refreshToken.User is null
            || refreshToken.User.IsBlocked)
        {
            return Unauthorized();
        }

        if (RefreshTokenRules.CanReplayWithinGracePeriod(refreshToken, now, RefreshReplayGracePeriod))
        {
            try
            {
                var replayedRawToken = refreshTokenProtector.Unprotect(refreshToken.ProtectedReplacementToken!);
                await transaction.CommitAsync();
                SetRefreshTokenCookie(replayedRawToken);
                return CreateAuthResponse(refreshToken.User);
            }
            catch (CryptographicException)
            {
                return Unauthorized();
            }
        }

        if (!RefreshTokenRules.IsUsable(refreshToken, now))
        {
            return Unauthorized();
        }

        var replacementRawToken = tokenService.CreateRefreshToken();
        var replacementHash = tokenService.HashRefreshToken(replacementRawToken);

        if (!RefreshTokenRules.TryRevokeForRotation(refreshToken, replacementHash, now))
        {
            return Unauthorized();
        }

        refreshToken.ProtectedReplacementToken = refreshTokenProtector.Protect(replacementRawToken);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = refreshToken.UserId,
            TokenHash = replacementHash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays)
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        SetRefreshTokenCookie(replacementRawToken);
        return CreateAuthResponse(refreshToken.User);
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var rawRefreshToken = Request.Cookies[RefreshTokenCookieName];

        if (!string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            var tokenHash = tokenService.HashRefreshToken(rawRefreshToken);
            var refreshToken = await db.RefreshTokens
                .FirstOrDefaultAsync(token => token.TokenHash == tokenHash);

            if (refreshToken is not null && RefreshTokenRules.IsUsable(refreshToken, DateTime.UtcNow))
            {
                refreshToken.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
        }

        DeleteRefreshTokenCookie();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserDto>> Me()
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId.Value);

        if (user is null || user.IsBlocked)
        {
            return Unauthorized();
        }

        return ToDto(user);
    }

    [Authorize]
    [HttpPut("me")]
    public async Task<ActionResult<AuthUserDto>> UpdateMe(UpdateProfileRequestDto request)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        if (!IsValidName(request.Name, out var nameError))
        {
            return BadRequest(nameError);
        }

        if (!IsValidEmail(request.Email, out var emailError))
        {
            return BadRequest(emailError);
        }

        if (!TryNormalizePhoneNumber(request.PhoneNumber, out var phoneNumber))
        {
            return BadRequest("Please enter a valid Azerbaijan phone number.");
        }

        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == userId.Value);

        if (user is null || user.IsBlocked)
        {
            return Unauthorized();
        }

        var email = NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(candidate => candidate.Email == email && candidate.Id != user.Id))
        {
            return Conflict("This email is already in use.");
        }

        if (IsPasswordChangeRequested(request))
        {
            if (!IsValidPassword(request.NewPassword, out _))
            {
                return BadRequest("New password does not meet the password requirements.");
            }

            if (!string.Equals(request.NewPassword, request.ConfirmNewPassword, StringComparison.Ordinal))
            {
                return BadRequest("Passwords do not match.");
            }

            user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        }

        user.Name = request.Name.Trim();
        user.Email = email;
        user.PhoneNumber = phoneNumber;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsUniqueEmailConflict(exception))
        {
            return Conflict("This email is already in use.");
        }

        return ToDto(user);
    }

    [Authorize]
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe()
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == userId.Value);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin profile cannot be deleted.");
        }

        await db.BookingRequests
            .Where(booking => booking.UserId == userId.Value)
            .ExecuteUpdateAsync(setters => setters.SetProperty(booking => booking.UserId, (int?)null));

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        DeleteRefreshTokenCookie();

        return NoContent();
    }

    private async Task<AuthResponseDto> CreateSessionAsync(AppUser user)
    {
        var rawRefreshToken = tokenService.CreateRefreshToken();
        var now = DateTime.UtcNow;

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenService.HashRefreshToken(rawRefreshToken),
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays)
        });
        await db.SaveChangesAsync();

        SetRefreshTokenCookie(rawRefreshToken);
        return CreateAuthResponse(user);
    }

    private AuthResponseDto CreateAuthResponse(AppUser user)
    {
        var accessToken = tokenService.CreateAccessToken(user);

        return new AuthResponseDto
        {
            User = ToDto(user),
            AccessToken = accessToken.Token,
            AccessTokenExpiresAt = accessToken.ExpiresAt
        };
    }

    private void SetRefreshTokenCookie(string rawRefreshToken)
    {
        Response.Cookies.Append(
            RefreshTokenCookieName,
            rawRefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                Path = RefreshTokenCookiePath,
                MaxAge = TimeSpan.FromDays(jwtOptions.Value.RefreshTokenDays)
            });
    }

    private void DeleteRefreshTokenCookie()
    {
        Response.Cookies.Delete(
            RefreshTokenCookieName,
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                Path = RefreshTokenCookiePath,
                MaxAge = TimeSpan.Zero
            });
    }

    private int? GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userId) ? userId : null;
    }

    internal static bool TryValidateRegistration(
        RegisterRequestDto request,
        out string name,
        out string email,
        out string phoneNumber,
        out string error)
    {
        name = request.Name.Trim();
        email = NormalizeEmail(request.Email);
        phoneNumber = string.Empty;

        if (!IsValidName(request.Name, out error))
        {
            return false;
        }

        if (!IsValidEmail(request.Email, out error))
        {
            return false;
        }

        if (!IsValidPassword(request.Password, out error))
        {
            return false;
        }

        if (!TryNormalizePhoneNumber(request.PhoneNumber, out phoneNumber))
        {
            error = "PhoneNumber must be a valid phone number.";
            return false;
        }

        return true;
    }

    private static bool IsPasswordChangeRequested(UpdateProfileRequestDto request)
    {
        return request.ChangePassword
            || !string.IsNullOrWhiteSpace(request.NewPassword)
            || !string.IsNullOrWhiteSpace(request.ConfirmNewPassword);
    }

    internal static bool IsValidNameEmailPassword(string name, string email, string password, out string error)
    {
        if (!IsValidName(name, out error))
        {
            return false;
        }

        if (!IsValidEmail(email, out error))
        {
            return false;
        }

        return IsValidPassword(password, out error);
    }

    private static bool IsValidName(string name, out string error)
    {
        var trimmed = name.Trim();

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            error = "Name is required.";
            return false;
        }

        if (trimmed.Length < 2)
        {
            error = "Name must be at least 2 characters.";
            return false;
        }

        if (trimmed.Length > 100)
        {
            error = "Name must be at most 100 characters.";
            return false;
        }

        if (!trimmed.Any(char.IsLetter)
            || trimmed.Any(character => !char.IsLetter(character) && !char.IsWhiteSpace(character) && character is not '-' and not '\''))
        {
            error = "Name must contain letters and may include spaces, hyphens, or apostrophes.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool IsValidEmail(string email, out string error)
    {
        var trimmed = email.Trim();

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            error = "Email is required.";
            return false;
        }

        if (trimmed.Length > 150)
        {
            error = "Email must be at most 150 characters.";
            return false;
        }

        if (trimmed.Any(char.IsWhiteSpace))
        {
            error = "Please enter a valid email address.";
            return false;
        }

        if (!MailAddress.TryCreate(trimmed, out var address)
            || !string.Equals(address.Address, trimmed, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(address.User)
            || string.IsNullOrWhiteSpace(address.Host)
            || !address.Host.Contains('.', StringComparison.Ordinal)
            || address.Host.StartsWith(".", StringComparison.Ordinal)
            || address.Host.EndsWith(".", StringComparison.Ordinal))
        {
            error = "Please enter a valid email address.";
            return false;
        }

        if (!NormalizeEmail(trimmed).EndsWith("@gmail.com", StringComparison.Ordinal))
        {
            error = "Only Gmail addresses (@gmail.com) are allowed.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool IsValidPassword(string password, out string error)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            error = "Password is required.";
            return false;
        }

        if (password.Length < 8)
        {
            error = "Password must be at least 8 characters.";
            return false;
        }

        if (password.Length > 128)
        {
            error = "Password must be at most 128 characters.";
            return false;
        }

        if (!password.Any(char.IsUpper))
        {
            error = "Password must contain an uppercase letter.";
            return false;
        }

        if (!password.Any(char.IsLower))
        {
            error = "Password must contain a lowercase letter.";
            return false;
        }

        if (!password.Any(char.IsDigit))
        {
            error = "Password must contain a number.";
            return false;
        }

        if (!password.Any(character => !char.IsLetterOrDigit(character)))
        {
            error = "Password must contain a special character.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    internal static string NormalizePhoneNumber(string phoneNumber)
    {
        TryNormalizePhoneNumber(phoneNumber, out var normalized);
        return normalized;
    }

    internal static bool TryNormalizePhoneNumber(string phoneNumber, out string normalized)
    {
        normalized = string.Empty;
        var trimmed = phoneNumber.Trim();

        if (string.IsNullOrWhiteSpace(trimmed)
            || trimmed.Any(character => !char.IsDigit(character) && !char.IsWhiteSpace(character) && character is not '+' and not '-' and not '(' and not ')'))
        {
            return false;
        }

        var plusIndex = trimmed.IndexOf('+');

        if (plusIndex > 0 || plusIndex != trimmed.LastIndexOf('+'))
        {
            return false;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        string localDigits;

        if (trimmed.StartsWith(AzerbaijanPhonePrefix, StringComparison.Ordinal))
        {
            localDigits = digits.StartsWith("994", StringComparison.Ordinal) ? digits[3..] : string.Empty;
        }
        else if (digits.Length == 12 && digits.StartsWith("994", StringComparison.Ordinal))
        {
            localDigits = digits[3..];
        }
        else if (digits.Length == 10 && digits.StartsWith("0", StringComparison.Ordinal))
        {
            localDigits = digits[1..];
        }
        else
        {
            localDigits = digits;
        }

        if (localDigits.Length == 10 && localDigits.StartsWith("0", StringComparison.Ordinal))
        {
            localDigits = localDigits[1..];
        }

        if (localDigits.Length != AzerbaijanPhoneDigitCount || !localDigits.All(char.IsDigit))
        {
            return false;
        }

        normalized = $"{AzerbaijanPhonePrefix}{localDigits}";
        return true;
    }

    internal static bool IsValidPhoneNumber(string phoneNumber)
    {
        return TryNormalizePhoneNumber(phoneNumber, out _);
    }

    internal static bool IsUniqueEmailConflict(DbUpdateException exception)
    {
        if (exception.InnerException is SqlException sqlException
            && sqlException.Errors.Cast<SqlError>().Any(error => error.Number is 2601 or 2627))
        {
            return true;
        }

        return exception.ToString().Contains("IX_Users_Email", StringComparison.OrdinalIgnoreCase);
    }

    internal static AuthUserDto ToDto(AppUser user) => new()
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        PhoneNumber = user.PhoneNumber,
        Role = user.Role,
        IsBlocked = user.IsBlocked
    };
}

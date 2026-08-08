using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
    IOptions<JwtOptions> jwtOptions) : ControllerBase
{
    private const string AzerbaijanPhonePrefix = "+994";
    private const int AzerbaijanPhoneDigitCount = 9;
    private const string RefreshTokenCookieName = "TravelHub.RefreshToken";
    private const string RefreshTokenCookiePath = "/api/auth";

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterRequestDto request)
    {
        if (!IsValidNameEmailPassword(request.Name, request.Email, request.Password, out var error))
        {
            return BadRequest(error);
        }

        if (!IsValidPhoneNumber(request.PhoneNumber))
        {
            return BadRequest("PhoneNumber must be a valid phone number.");
        }

        var email = NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(user => user.Email == email))
        {
            return Conflict("User with this email already exists.");
        }

        var user = new AppUser
        {
            Name = request.Name.Trim(),
            Email = email,
            PhoneNumber = NormalizePhoneNumber(request.PhoneNumber),
            Role = UserRoles.User
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();

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
            || refreshToken.User.IsBlocked
            || !RefreshTokenRules.IsUsable(refreshToken, now))
        {
            return Unauthorized();
        }

        var replacementRawToken = tokenService.CreateRefreshToken();
        var replacementHash = tokenService.HashRefreshToken(replacementRawToken);

        if (!RefreshTokenRules.TryRevokeForRotation(refreshToken, replacementHash, now))
        {
            return Unauthorized();
        }

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

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Name is required.");
        }

        if (!IsValidPhoneNumber(request.PhoneNumber))
        {
            return BadRequest("PhoneNumber must be a valid phone number.");
        }

        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == userId.Value);

        if (user is null || user.IsBlocked)
        {
            return Unauthorized();
        }

        user.Name = request.Name.Trim();
        user.PhoneNumber = NormalizePhoneNumber(request.PhoneNumber);
        await db.SaveChangesAsync();

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

    internal static bool IsValidNameEmailPassword(string name, string email, string password, out string error)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            error = "Name, Email and Password are required.";
            return false;
        }

        if (password.Length < 6)
        {
            error = "Password must be at least 6 characters.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    internal static string NormalizePhoneNumber(string phoneNumber)
    {
        var trimmed = phoneNumber.Trim();
        var rest = trimmed.StartsWith(AzerbaijanPhonePrefix, StringComparison.Ordinal)
            ? trimmed[AzerbaijanPhonePrefix.Length..].Trim()
            : trimmed;

        return $"{AzerbaijanPhonePrefix} {rest}";
    }

    internal static bool IsValidPhoneNumber(string phoneNumber)
    {
        var trimmed = phoneNumber.Trim();
        var rest = trimmed.StartsWith(AzerbaijanPhonePrefix, StringComparison.Ordinal)
            ? trimmed[AzerbaijanPhonePrefix.Length..]
            : string.Empty;
        var digits = rest.Count(char.IsDigit);

        return digits == AzerbaijanPhoneDigitCount
            && rest.All(character => char.IsDigit(character) || char.IsWhiteSpace(character) || character is '-' or '(' or ')');
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

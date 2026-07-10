using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, PasswordHasher<AppUser> passwordHasher) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthUserDto>> Register(RegisterRequestDto request)
    {
        if (!IsValidNameEmailPassword(request.Name, request.Email, request.Password, out var error))
        {
            return BadRequest(error);
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
            Role = UserRoles.User
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        await SignInAsync(user);

        return ToDto(user);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthUserDto>> Login(LoginRequestDto request)
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

        await SignInAsync(user);
        return ToDto(user);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
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

    private async Task SignInAsync(AppUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });
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

    internal static AuthUserDto ToDto(AppUser user) => new()
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        Role = user.Role,
        IsBlocked = user.IsBlocked
    };
}

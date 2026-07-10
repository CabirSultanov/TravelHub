using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.SuperAdmin)]
[Route("api/admins")]
public class AdminsController(AppDbContext db, PasswordHasher<AppUser> passwordHasher) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AuthUserDto>>> GetAdmins(string? role)
    {
        var targetRole = string.Equals(role, UserRoles.User, StringComparison.OrdinalIgnoreCase)
            ? UserRoles.User
            : UserRoles.Admin;

        return await db.Users.AsNoTracking()
            .Where(user => user.Role == targetRole)
            .Select(user => new AuthUserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                IsBlocked = user.IsBlocked
            })
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<AuthUserDto>> CreateAdmin(CreateAdminRequestDto request)
    {
        if (!AuthController.IsValidNameEmailPassword(request.Name, request.Email, request.Password, out var error))
        {
            return BadRequest(error);
        }

        var email = AuthController.NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(user => user.Email == email))
        {
            return Conflict("User with this email already exists.");
        }

        var user = new AppUser
        {
            Name = request.Name.Trim(),
            Email = email,
            Role = UserRoles.Admin
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAdmins), AuthController.ToDto(user));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AuthUserDto>> PromoteUser(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin is already above admin.");
        }

        user.Role = UserRoles.Admin;
        await db.SaveChangesAsync();

        return AuthController.ToDto(user);
    }

    [HttpPut("{id:int}/block")]
    public async Task<ActionResult<AuthUserDto>> BlockUser(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin cannot be blocked.");
        }

        user.IsBlocked = true;
        await db.SaveChangesAsync();

        return AuthController.ToDto(user);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> RemoveAdmin(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin cannot be removed here.");
        }

        if (user.Role != UserRoles.Admin)
        {
            return BadRequest("User is not an admin.");
        }

        user.Role = UserRoles.User;
        await db.SaveChangesAsync();

        return NoContent();
    }
}

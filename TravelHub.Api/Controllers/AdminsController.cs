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
    private const int DefaultRegularUsersPageSize = 10;
    private const int MaxRegularUsersPageSize = 100;

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
                PhoneNumber = user.PhoneNumber,
                Role = user.Role,
                IsBlocked = user.IsBlocked
            })
            .ToListAsync();
    }

    [HttpGet("users")]
    public async Task<ActionResult<PagedResponseDto<AuthUserDto>>> GetRegularUsers(int page = 1, int pageSize = DefaultRegularUsersPageSize)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, MaxRegularUsersPageSize);
        var query = db.Users.AsNoTracking().Where(user => user.Role == UserRoles.User);
        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)normalizedPageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(normalizedPage, totalPages);
        var items = await query
            .OrderBy(user => user.Id)
            .Skip((effectivePage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .Select(user => new AuthUserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = user.Role,
                IsBlocked = user.IsBlocked
            })
            .ToListAsync();

        return new PagedResponseDto<AuthUserDto>
        {
            Items = items,
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    [HttpPost]
    public async Task<ActionResult<AuthUserDto>> CreateAdmin(CreateAdminRequestDto request)
    {
        if (!AuthController.TryValidateRegistration(request, out var name, out var email, out var phoneNumber, out var error))
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
            Role = UserRoles.Admin,
            EmailConfirmed = true
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (AuthController.IsUniqueEmailConflict(exception))
        {
            return Conflict("User with this email already exists.");
        }

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

    [HttpPut("{id:int}/unblock")]
    public async Task<ActionResult<AuthUserDto>> UnblockUser(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin cannot be unblocked here.");
        }

        user.IsBlocked = false;
        await db.SaveChangesAsync();

        return AuthController.ToDto(user);
    }

    [HttpDelete("{id:int}")]
    [HttpDelete("{id:int}/account")]
    public async Task<IActionResult> DeleteAccount(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(user => user.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.SuperAdmin)
        {
            return BadRequest("Super admin cannot be deleted here.");
        }

        await db.BookingRequests
            .Where(booking => booking.UserId == id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(booking => booking.UserId, (int?)null));

        db.Users.Remove(user);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id:int}/demote")]
    public async Task<IActionResult> DemoteAdmin(int id)
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

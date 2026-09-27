using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
[Route("api/ownership")]
public class OwnershipController(AppDbContext db) : ControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult<List<AuthUserDto>>> GetOwnerCandidates(string role, CancellationToken cancellationToken)
    {
        if (!OwnershipRules.IsAdministrator(User))
        {
            return Forbid();
        }

        var ownerRole = string.Equals(role, "hotel", StringComparison.OrdinalIgnoreCase)
            ? UserRoles.HotelOwner
            : string.Equals(role, "taxi", StringComparison.OrdinalIgnoreCase)
                ? UserRoles.TaxiOwner
                : null;

        if (ownerRole is null)
        {
            return BadRequest("Role must be hotel or taxi.");
        }

        return await db.Users.AsNoTracking()
            .Where(user => user.Role == UserRoles.User || user.Role == ownerRole)
            .OrderBy(user => user.Name)
            .ThenBy(user => user.Email)
            .Select(user => new AuthUserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = user.Role,
                IsBlocked = user.IsBlocked
            })
            .ToListAsync(cancellationToken);
    }
}

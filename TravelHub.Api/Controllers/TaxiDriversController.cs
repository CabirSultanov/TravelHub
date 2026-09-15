using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.AdminOrSuperAdminOrTaxiOwner)]
[Route("api/taxi-services/{taxiServiceId:int}/drivers")]
public class TaxiDriversController(AppDbContext db) : ControllerBase
{
    private const int MaxCandidateCount = 50;

    [HttpGet]
    public async Task<ActionResult<List<AuthUserDto>>> GetDrivers(int taxiServiceId, CancellationToken cancellationToken)
    {
        var taxiService = await FindManageableTaxiService(taxiServiceId, cancellationToken);
        if (taxiService.Result is not null)
        {
            return taxiService.Result;
        }

        return await db.Users.AsNoTracking()
            .Where(user => user.Role == UserRoles.TaxiDriver && user.TaxiServiceId == taxiServiceId)
            .OrderBy(user => user.Name)
            .ThenBy(user => user.Email)
            .Select(ToDto)
            .ToListAsync(cancellationToken);
    }

    [HttpGet("candidates")]
    public async Task<ActionResult<List<AuthUserDto>>> GetCandidates(int taxiServiceId, string? search, CancellationToken cancellationToken)
    {
        var taxiService = await FindManageableTaxiService(taxiServiceId, cancellationToken);
        if (taxiService.Result is not null)
        {
            return taxiService.Result;
        }

        var query = db.Users.AsNoTracking().Where(user => user.Role == UserRoles.User && !user.IsBlocked);
        var normalizedSearch = search?.Trim();
        if (!string.IsNullOrEmpty(normalizedSearch))
        {
            var searchTerm = normalizedSearch.ToUpper();
            query = query.Where(user => user.Name.ToUpper().Contains(searchTerm) || user.Email.ToUpper().Contains(searchTerm));
        }

        return await query
            .OrderBy(user => user.Name)
            .ThenBy(user => user.Email)
            .Take(MaxCandidateCount)
            .Select(ToDto)
            .ToListAsync(cancellationToken);
    }

    [HttpPut("{userId:int}")]
    public async Task<IActionResult> AssignDriver(int taxiServiceId, int userId, CancellationToken cancellationToken)
    {
        var taxiService = await FindManageableTaxiService(taxiServiceId, cancellationToken);
        if (taxiService.Result is not null)
        {
            return taxiService.Result;
        }

        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRoles.TaxiDriver)
        {
            return user.TaxiServiceId == taxiServiceId
                ? NoContent()
                : BadRequest("Driver already belongs to another taxi service.");
        }

        if (user.Role != UserRoles.User)
        {
            return BadRequest("Only regular users can be assigned as drivers.");
        }

        if (user.IsBlocked)
        {
            return BadRequest("Blocked users cannot be assigned as taxi drivers.");
        }

        user.Role = UserRoles.TaxiDriver;
        user.TaxiServiceId = taxiServiceId;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("{userId:int}")]
    public async Task<IActionResult> RemoveDriver(int taxiServiceId, int userId, CancellationToken cancellationToken)
    {
        var taxiService = await FindManageableTaxiService(taxiServiceId, cancellationToken);
        if (taxiService.Result is not null)
        {
            return taxiService.Result;
        }

        var driver = await db.Users.FirstOrDefaultAsync(user => user.Id == userId && user.TaxiServiceId == taxiServiceId, cancellationToken);
        if (driver is null)
        {
            return NotFound();
        }

        if (driver.Role != UserRoles.TaxiDriver)
        {
            return BadRequest("User is not a taxi driver.");
        }

        var hasActiveRide = await db.TaxiBookings.AnyAsync(booking => booking.DriverId == driver.Id
            && (booking.Status == TaxiBookingStatus.DriverAssigned || booking.Status == TaxiBookingStatus.DriverArrived), cancellationToken);
        if (hasActiveRide)
        {
            return BadRequest("A driver with an active ride cannot be removed.");
        }

        driver.Role = UserRoles.User;
        driver.TaxiServiceId = null;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<ActionResult<TaxiService>> FindManageableTaxiService(int taxiServiceId, CancellationToken cancellationToken)
    {
        var taxiService = await db.TaxiServices.AsNoTracking().FirstOrDefaultAsync(service => service.Id == taxiServiceId, cancellationToken);
        if (taxiService is null)
        {
            return NotFound();
        }

        return OwnershipRules.CanManageTaxiService(User, taxiService)
            ? taxiService
            : Forbid();
    }

    private static readonly System.Linq.Expressions.Expression<Func<AppUser, AuthUserDto>> ToDto = user => new AuthUserDto
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        PhoneNumber = user.PhoneNumber,
        Role = user.Role,
        IsBlocked = user.IsBlocked,
        TaxiServiceId = user.TaxiServiceId
    };
}

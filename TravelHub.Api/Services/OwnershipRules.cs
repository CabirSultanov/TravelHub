using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public static class OwnershipRules
{
    public static bool IsAdministrator(ClaimsPrincipal user) =>
        user.IsInRole(UserRoles.Admin) || user.IsInRole(UserRoles.SuperAdmin);

    public static bool CanManageHotel(ClaimsPrincipal user, Hotel hotel) =>
        IsAdministrator(user) ||
        (user.IsInRole(UserRoles.HotelOwner) && hotel.OwnerId == GetUserId(user));

    public static bool CanManageTaxiService(ClaimsPrincipal user, TaxiService taxiService) =>
        IsAdministrator(user) ||
        (user.IsInRole(UserRoles.TaxiOwner) && taxiService.OwnerId == GetUserId(user));

    public static async Task<(AppUser? User, string? Error)> ResolveOwnerAsync(
        AppDbContext db,
        int? ownerId,
        string ownerRole,
        CancellationToken cancellationToken)
    {
        if (ownerId is null)
        {
            return (null, null);
        }

        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Id == ownerId.Value, cancellationToken);

        if (user is null)
        {
            return (null, "Owner user does not exist.");
        }

        if (user.Role is UserRoles.Admin or UserRoles.SuperAdmin)
        {
            return (null, "Admins and super admins do not need an owner assignment.");
        }

        if (user.Role is not UserRoles.User && user.Role != ownerRole)
        {
            return (null, "User already has a different owner role.");
        }

        user.Role = ownerRole;
        return (user, null);
    }

    public static async Task ClearUnusedOwnerRoleAsync(
        AppDbContext db,
        int? ownerId,
        string ownerRole,
        CancellationToken cancellationToken)
    {
        if (ownerId is null)
        {
            return;
        }

        var user = await db.Users.FindAsync([ownerId.Value], cancellationToken);

        if (user is null || user.Role != ownerRole)
        {
            return;
        }

        var hasOwnedResources = ownerRole == UserRoles.HotelOwner
            ? await db.Hotels.AnyAsync(hotel => hotel.OwnerId == ownerId.Value, cancellationToken)
            : await db.TaxiServices.AnyAsync(taxiService => taxiService.OwnerId == ownerId.Value, cancellationToken);

        if (!hasOwnedResources)
        {
            user.Role = UserRoles.User;
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static int? GetUserId(ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userId) ? userId : null;
    }
}

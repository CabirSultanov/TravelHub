using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public static class AccountDeletion
{
    public const string ActiveRideError = "An account with an active driver ride cannot be deleted. Finish the ride first.";

    public static async Task<bool> TryDeleteAsync(AppDbContext db, AppUser user)
    {
        // Former drivers can still have these references, regardless of their current role.
        var rides = await db.TaxiBookings.Where(ride => ride.DriverId == user.Id).ToListAsync();
        if (rides.Any(ride => ride.Status is TaxiBookingStatus.DriverAssigned or TaxiBookingStatus.DriverArrived))
            return false;

        var declines = await db.TaxiBookingDriverDeclines.Where(decline => decline.DriverId == user.Id).ToListAsync();
        var bookings = await db.BookingRequests.Where(booking => booking.UserId == user.Id).ToListAsync();

        foreach (var ride in rides)
        {
            ride.DriverId = null;
            ride.Driver = null;
        }
        foreach (var booking in bookings)
        {
            booking.UserId = null;
            booking.User = null;
        }
        db.TaxiBookingDriverDeclines.RemoveRange(declines);
        db.Users.Remove(user);
        // One SaveChanges transaction: a failed delete must not leave partially cleared history.
        await db.SaveChangesAsync();
        return true;
    }
}

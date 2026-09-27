using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.TaxiDriver)]
[Route("api/driver/taxi-bookings")]
public class DriverTaxiBookingsController(AppDbContext db) : ControllerBase
{
    [HttpGet("available")]
    public async Task<ActionResult<List<TaxiDriverRideResponseDto>>> GetAvailable(CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var bookings = await db.TaxiBookings.AsNoTracking()
            .Where(booking => booking.TaxiServiceId == driver.TaxiServiceId
                && booking.Status == TaxiBookingStatus.AwaitingDriver
                && !booking.DriverDeclines.Any(decline => decline.DriverId == driver.Id))
            .OrderBy(booking => booking.Id)
            .ToListAsync(cancellationToken);
        return bookings.Select(ToRide).ToList();
    }

    [HttpGet("active")]
    public async Task<ActionResult<TaxiDriverRideResponseDto>> GetActive(CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var booking = await db.TaxiBookings.AsNoTracking()
            .Where(current => current.DriverId == driver.Id
                && (current.Status == TaxiBookingStatus.DriverAssigned || current.Status == TaxiBookingStatus.DriverArrived))
            .OrderByDescending(current => current.AcceptedAt)
            .FirstOrDefaultAsync(cancellationToken);
        return booking is null ? NotFound() : ToRide(booking);
    }

    [HttpGet("history")]
    public async Task<ActionResult<List<TaxiDriverRideResponseDto>>> GetHistory(CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var bookings = await db.TaxiBookings.AsNoTracking()
            .Where(booking => booking.DriverId == driver.Id && booking.Status == TaxiBookingStatus.Completed)
            .OrderByDescending(booking => booking.CompletedAt)
            .ToListAsync(cancellationToken);
        return bookings.Select(ToRide).ToList();
    }

    [HttpPost("{id:int}/accept")]
    public async Task<ActionResult<TaxiDriverRideResponseDto>> Accept(int id, CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var alreadyActive = await db.TaxiBookings.AnyAsync(booking => booking.DriverId == driver.Id
            && (booking.Status == TaxiBookingStatus.DriverAssigned || booking.Status == TaxiBookingStatus.DriverArrived), cancellationToken);
        if (alreadyActive) return Conflict("Finish the active ride before accepting another one.");

        var booking = await db.TaxiBookings.FirstOrDefaultAsync(current => current.Id == id && current.TaxiServiceId == driver.TaxiServiceId, cancellationToken);
        if (booking is null) return NotFound();
        if (booking.Status != TaxiBookingStatus.AwaitingDriver) return Conflict("This ride is no longer available.");
        if (booking.PaymentToken is null) return Conflict("This ride has no payment method.");

        var declined = await db.TaxiBookingDriverDeclines.AnyAsync(decline => decline.TaxiBookingId == id && decline.DriverId == driver.Id, cancellationToken);
        if (declined) return Conflict("You declined this ride.");

        booking.DriverId = driver.Id;
        booking.Status = TaxiBookingStatus.DriverAssigned;
        booking.AcceptedAt = DateTime.UtcNow;
        booking.PaidAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("This ride was accepted by another driver.");
        }

        return ToRide(booking);
    }

    [HttpPost("{id:int}/decline")]
    public async Task<IActionResult> Decline(int id, CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var booking = await db.TaxiBookings.AsNoTracking()
            .FirstOrDefaultAsync(current => current.Id == id && current.TaxiServiceId == driver.TaxiServiceId, cancellationToken);
        if (booking is null) return NotFound();
        if (booking.Status != TaxiBookingStatus.AwaitingDriver) return Conflict("This ride is no longer available.");

        var alreadyDeclined = await db.TaxiBookingDriverDeclines.AnyAsync(decline => decline.TaxiBookingId == id && decline.DriverId == driver.Id, cancellationToken);
        if (alreadyDeclined) return NoContent();

        db.TaxiBookingDriverDeclines.Add(new TaxiBookingDriverDecline { TaxiBookingId = id, DriverId = driver.Id });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return NoContent();
        }

        return NoContent();
    }

    [HttpPost("{id:int}/arrived")]
    public Task<ActionResult<TaxiDriverRideResponseDto>> Arrived(int id, CancellationToken cancellationToken) =>
        UpdateStatus(id, TaxiBookingStatus.DriverAssigned, TaxiBookingStatus.DriverArrived, cancellationToken);

    [HttpPost("{id:int}/complete")]
    public Task<ActionResult<TaxiDriverRideResponseDto>> Complete(int id, CancellationToken cancellationToken) =>
        UpdateStatus(id, TaxiBookingStatus.DriverArrived, TaxiBookingStatus.Completed, cancellationToken);

    private async Task<ActionResult<TaxiDriverRideResponseDto>> UpdateStatus(
        int id,
        TaxiBookingStatus expectedStatus,
        TaxiBookingStatus nextStatus,
        CancellationToken cancellationToken)
    {
        var driver = await GetCurrentDriverAsync(cancellationToken);
        if (driver is null) return Forbid();

        var booking = await db.TaxiBookings.FirstOrDefaultAsync(current => current.Id == id && current.DriverId == driver.Id, cancellationToken);
        if (booking is null) return NotFound();
        if (booking.Status != expectedStatus) return Conflict("This ride cannot be updated in its current status.");

        booking.Status = nextStatus;
        if (nextStatus == TaxiBookingStatus.DriverArrived) booking.ArrivedAt = DateTime.UtcNow;
        if (nextStatus == TaxiBookingStatus.Completed) booking.CompletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return ToRide(booking);
    }

    private async Task<AppUser?> GetCurrentDriverAsync(CancellationToken cancellationToken)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(value, out var driverId)) return null;

        return await db.Users.FirstOrDefaultAsync(user => user.Id == driverId
            && user.Role == UserRoles.TaxiDriver
            && !user.IsBlocked
            && user.TaxiServiceId != null, cancellationToken);
    }

    private static TaxiDriverRideResponseDto ToRide(TaxiBooking booking) => new()
    {
        Id = booking.Id,
        TaxiServiceName = booking.TaxiServiceName,
        CarClassName = booking.CarClassName,
        CustomerName = booking.CustomerName,
        PhoneNumber = booking.PhoneNumber,
        PickupAddress = booking.PickupAddress,
        DropoffAddress = booking.DropoffAddress,
        DistanceKm = booking.DistanceKm,
        TotalPrice = booking.TotalPrice,
        Status = booking.Status.ToString(),
        AcceptedAt = booking.AcceptedAt,
        ArrivedAt = booking.ArrivedAt,
        CompletedAt = booking.CompletedAt
    };
}

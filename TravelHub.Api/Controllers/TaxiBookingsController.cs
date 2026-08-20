using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/taxi-bookings")]
public class TaxiBookingsController(AppDbContext db, IRoutingService routingService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<TaxiBookingResponseDto>>> GetTaxiBookings(bool mine = false)
    {
        var query = db.TaxiBookings.AsNoTracking();

        if (mine || !IsAdmin())
        {
            var userId = GetCurrentUserId();

            if (userId is null)
            {
                return Unauthorized();
            }

            query = query.Where(booking => booking.UserId == userId.Value);
        }

        return await query
            .OrderByDescending(booking => booking.Id)
            .Select(booking => new TaxiBookingResponseDto
            {
                Id = booking.Id,
                UserId = booking.UserId,
                TaxiServiceId = booking.TaxiServiceId,
                TaxiServiceName = booking.TaxiServiceName,
                CarClassName = booking.CarClassName,
                CustomerName = booking.CustomerName,
                PhoneNumber = booking.PhoneNumber,
                Email = booking.Email,
                PickupAddress = booking.PickupAddress,
                DropoffAddress = booking.DropoffAddress,
                PickupX = booking.PickupX,
                PickupY = booking.PickupY,
                DropoffX = booking.DropoffX,
                DropoffY = booking.DropoffY,
                PickupLatitude = booking.PickupLatitude,
                PickupLongitude = booking.PickupLongitude,
                DropoffLatitude = booking.DropoffLatitude,
                DropoffLongitude = booking.DropoffLongitude,
                DistanceKm = booking.DistanceKm,
                PricePerKm = booking.PricePerKm,
                TotalPrice = booking.TotalPrice,
                Status = booking.Status.ToString(),
                PaidAt = booking.PaidAt,
                CancelledAt = booking.CancelledAt,
                SavedCardLast4 = booking.SavedCardLast4
            })
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<TaxiBookingResponseDto>> CreateTaxiBooking(
        TaxiBookingCreateDto bookingDto,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(bookingDto.CustomerName) ||
            string.IsNullOrWhiteSpace(bookingDto.PhoneNumber) ||
            string.IsNullOrWhiteSpace(bookingDto.Email) ||
            string.IsNullOrWhiteSpace(bookingDto.PickupAddress) ||
            string.IsNullOrWhiteSpace(bookingDto.DropoffAddress))
        {
            return BadRequest("CustomerName, PhoneNumber, Email, PickupAddress and DropoffAddress are required.");
        }

        if (!TaxiBookingRules.IsLatitude(bookingDto.PickupLatitude) ||
            !TaxiBookingRules.IsLongitude(bookingDto.PickupLongitude) ||
            !TaxiBookingRules.IsLatitude(bookingDto.DropoffLatitude) ||
            !TaxiBookingRules.IsLongitude(bookingDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff latitude/longitude values are invalid.");
        }

        if (TaxiBookingRules.IsSameLocation(
            bookingDto.PickupLatitude,
            bookingDto.PickupLongitude,
            bookingDto.DropoffLatitude,
            bookingDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff points must be different.");
        }

        var taxiService = await db.TaxiServices
            .Include(service => service.CarClasses)
            .AsNoTracking()
            .FirstOrDefaultAsync(service => service.Id == bookingDto.TaxiServiceId);

        if (taxiService is null)
        {
            return BadRequest("Taxi service does not exist.");
        }

        var carClassName = bookingDto.CarClassName.Trim();
        var carClass = taxiService.CarClasses.FirstOrDefault(currentClass =>
            currentClass.Name.Equals(carClassName, StringComparison.OrdinalIgnoreCase));

        if (carClass is null)
        {
            return BadRequest("Car class does not belong to selected taxi service.");
        }

        TaxiRouteResult route;

        try
        {
            route = await routingService.GetRouteAsync(
                bookingDto.PickupLatitude,
                bookingDto.PickupLongitude,
                bookingDto.DropoffLatitude,
                bookingDto.DropoffLongitude,
                cancellationToken);
        }
        catch (RoutingUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Unable to calculate taxi route. Please try again.");
        }

        var totalPrice = TaxiBookingRules.CalculateTotalPrice(route.DistanceKm, carClass.PricePerKm);
        var pickupLegacyPoint = TaxiBookingRules.ToLegacyMapPoint(bookingDto.PickupLatitude, bookingDto.PickupLongitude);
        var dropoffLegacyPoint = TaxiBookingRules.ToLegacyMapPoint(bookingDto.DropoffLatitude, bookingDto.DropoffLongitude);

        var previousPendingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == userId.Value && booking.Status == BookingStatus.PendingPayment)
            .ToListAsync();
        var cancelledAt = DateTime.UtcNow;

        foreach (var previousBooking in previousPendingBookings)
        {
            previousBooking.Status = BookingStatus.Cancelled;
            previousBooking.CancelledAt = cancelledAt;
        }

        var taxiBooking = new TaxiBooking
        {
            UserId = userId.Value,
            TaxiServiceId = taxiService.Id,
            TaxiServiceName = taxiService.CompanyName,
            CarClassName = carClass.Name,
            CustomerName = bookingDto.CustomerName.Trim(),
            PhoneNumber = bookingDto.PhoneNumber.Trim(),
            Email = bookingDto.Email.Trim(),
            PickupAddress = bookingDto.PickupAddress.Trim(),
            DropoffAddress = bookingDto.DropoffAddress.Trim(),
            PickupX = pickupLegacyPoint.X,
            PickupY = pickupLegacyPoint.Y,
            DropoffX = dropoffLegacyPoint.X,
            DropoffY = dropoffLegacyPoint.Y,
            PickupLatitude = bookingDto.PickupLatitude,
            PickupLongitude = bookingDto.PickupLongitude,
            DropoffLatitude = bookingDto.DropoffLatitude,
            DropoffLongitude = bookingDto.DropoffLongitude,
            DistanceKm = route.DistanceKm,
            PricePerKm = carClass.PricePerKm,
            TotalPrice = totalPrice,
            Status = BookingStatus.PendingPayment
        };

        db.TaxiBookings.Add(taxiBooking);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTaxiBookings), ToResponse(taxiBooking));
    }

    [HttpPost("{id:int}/pay")]
    public async Task<ActionResult<TaxiBookingResponseDto>> PayTaxiBooking(int id, BookingPaymentDto paymentDto)
    {
        var taxiBooking = await db.TaxiBookings.FirstOrDefaultAsync(booking => booking.Id == id);

        if (taxiBooking is null)
        {
            return NotFound();
        }

        if (!CanAccess(taxiBooking))
        {
            return Forbid();
        }

        if (taxiBooking.Status != BookingStatus.PendingPayment)
        {
            return Conflict("Only pending taxi bookings can be paid.");
        }

        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        string? savedCardLast4;

        if (paymentDto.SavedPaymentCardId is not null)
        {
            var savedCard = await db.SavedPaymentCards
                .AsNoTracking()
                .FirstOrDefaultAsync(card => card.Id == paymentDto.SavedPaymentCardId.Value && card.UserId == userId.Value);

            if (savedCard is null)
            {
                return BadRequest("Saved payment card does not exist.");
            }

            if (PaymentCardRules.IsExpired(savedCard.ExpiryMonth, savedCard.ExpiryYear))
            {
                return BadRequest("Saved payment card is expired.");
            }

            savedCardLast4 = savedCard.Last4;
        }
        else
        {
            var validationError = PaymentCardRules.CreateCard(
                paymentDto.CardNumber,
                paymentDto.CardHolderName,
                paymentDto.ExpiryMonth,
                paymentDto.ExpiryYear,
                paymentDto.Cvv,
                out var cardDraft);

            if (validationError is not null)
            {
                return BadRequest(validationError);
            }

            if (paymentDto.SaveCard)
            {
                db.SavedPaymentCards.Add(new SavedPaymentCard
                {
                    UserId = userId.Value,
                    CardHolderName = cardDraft.CardHolderName,
                    Brand = cardDraft.Brand,
                    Last4 = cardDraft.Last4,
                    ExpiryMonth = cardDraft.ExpiryMonth,
                    ExpiryYear = cardDraft.ExpiryYear,
                    Token = cardDraft.Token
                });
            }

            savedCardLast4 = paymentDto.SaveCard ? cardDraft.Last4 : null;
        }

        taxiBooking.Status = BookingStatus.Paid;
        taxiBooking.PaidAt = DateTime.UtcNow;
        taxiBooking.SavedCardLast4 = savedCardLast4;

        await db.SaveChangesAsync();

        return ToResponse(taxiBooking);
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> CancelTaxiBooking(int id)
    {
        var taxiBooking = await db.TaxiBookings.FindAsync(id);

        if (taxiBooking is null)
        {
            return NotFound();
        }

        if (!CanAccess(taxiBooking))
        {
            return Forbid();
        }

        if (taxiBooking.Status != BookingStatus.PendingPayment)
        {
            return Conflict("Only pending taxi bookings can be cancelled.");
        }

        taxiBooking.Status = BookingStatus.Cancelled;
        taxiBooking.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static TaxiBookingResponseDto ToResponse(TaxiBooking booking) => new()
    {
        Id = booking.Id,
        UserId = booking.UserId,
        TaxiServiceId = booking.TaxiServiceId,
        TaxiServiceName = booking.TaxiServiceName,
        CarClassName = booking.CarClassName,
        CustomerName = booking.CustomerName,
        PhoneNumber = booking.PhoneNumber,
        Email = booking.Email,
        PickupAddress = booking.PickupAddress,
        DropoffAddress = booking.DropoffAddress,
        PickupX = booking.PickupX,
        PickupY = booking.PickupY,
        DropoffX = booking.DropoffX,
        DropoffY = booking.DropoffY,
        PickupLatitude = booking.PickupLatitude,
        PickupLongitude = booking.PickupLongitude,
        DropoffLatitude = booking.DropoffLatitude,
        DropoffLongitude = booking.DropoffLongitude,
        DistanceKm = booking.DistanceKm,
        PricePerKm = booking.PricePerKm,
        TotalPrice = booking.TotalPrice,
        Status = booking.Status.ToString(),
        PaidAt = booking.PaidAt,
        CancelledAt = booking.CancelledAt,
        SavedCardLast4 = booking.SavedCardLast4
    };

    private bool IsAdmin() => User.IsInRole(UserRoles.Admin) || User.IsInRole(UserRoles.SuperAdmin);

    private bool CanAccess(TaxiBooking booking)
    {
        var userId = GetCurrentUserId();
        return IsAdmin() || userId == booking.UserId;
    }

    private int? GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userId) ? userId : null;
    }
}

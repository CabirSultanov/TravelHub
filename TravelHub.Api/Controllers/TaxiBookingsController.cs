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
            if (userId is null) return Unauthorized();
            query = query.Where(booking => booking.UserId == userId.Value);
        }

        var bookings = await query.Include(booking => booking.Driver)
            .OrderByDescending(booking => booking.Id)
            .ToListAsync();
        return bookings.Select(ToResponse).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaxiBookingResponseDto>> GetTaxiBooking(int id, CancellationToken cancellationToken)
    {
        if (GetCurrentUserId() is null) return Unauthorized();

        var booking = await db.TaxiBookings.AsNoTracking()
            .Include(current => current.Driver)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);
        if (booking is null) return NotFound();
        if (!CanAccess(booking)) return Forbid();

        return ToResponse(booking);
    }

    [HttpPost("{id:int}/review")]
    public async Task<ActionResult<TaxiBookingResponseDto>> ReviewTaxiBooking(int id, TaxiBookingReviewDto reviewDto, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();

        var booking = await db.TaxiBookings.Include(current => current.Driver)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);
        if (booking is null) return NotFound();
        if (booking.UserId != userId.Value) return Forbid();
        if (booking.Status != TaxiBookingStatus.Completed) return Conflict("Only completed rides can be reviewed.");
        if (booking.Rating is not null) return Conflict("You have already reviewed this ride.");
        if (reviewDto.Rating is < 1 or > 5) return BadRequest("Rating must be an integer from 1 to 5.");

        var comment = string.IsNullOrWhiteSpace(reviewDto.Comment) ? null : reviewDto.Comment.Trim();
        if (comment?.Length > 1000) return BadRequest("Comment must be 1000 characters or fewer.");

        booking.Rating = reviewDto.Rating;
        booking.ReviewComment = comment;
        booking.ReviewedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("This ride was updated. Refresh it before submitting a review again.");
        }

        return ToResponse(booking);
    }

    [HttpPost]
    public async Task<ActionResult<TaxiBookingResponseDto>> CreateTaxiBooking(TaxiBookingCreateDto bookingDto, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();

        if (bookingDto.Payment is null ||
            string.IsNullOrWhiteSpace(bookingDto.CustomerName) ||
            string.IsNullOrWhiteSpace(bookingDto.PhoneNumber) ||
            string.IsNullOrWhiteSpace(bookingDto.Email) ||
            string.IsNullOrWhiteSpace(bookingDto.PickupAddress) ||
            string.IsNullOrWhiteSpace(bookingDto.DropoffAddress))
        {
            return BadRequest("CustomerName, PhoneNumber, Email, PickupAddress, DropoffAddress and Payment are required.");
        }

        if (!TaxiBookingRules.IsLatitude(bookingDto.PickupLatitude) ||
            !TaxiBookingRules.IsLongitude(bookingDto.PickupLongitude) ||
            !TaxiBookingRules.IsLatitude(bookingDto.DropoffLatitude) ||
            !TaxiBookingRules.IsLongitude(bookingDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff latitude/longitude values are invalid.");
        }

        if (TaxiBookingRules.IsSameLocation(bookingDto.PickupLatitude, bookingDto.PickupLongitude, bookingDto.DropoffLatitude, bookingDto.DropoffLongitude))
        {
            return BadRequest("Pickup and dropoff points must be different.");
        }

        var taxiService = await db.TaxiServices.Include(service => service.CarClasses).AsNoTracking()
            .FirstOrDefaultAsync(service => service.Id == bookingDto.TaxiServiceId, cancellationToken);
        if (taxiService is null) return BadRequest("Taxi service does not exist.");

        var carClassName = bookingDto.CarClassName.Trim();
        var carClass = taxiService.CarClasses.FirstOrDefault(currentClass => currentClass.Name.Equals(carClassName, StringComparison.OrdinalIgnoreCase));
        if (carClass is null) return BadRequest("Car class does not belong to selected taxi service.");

        var paymentMethod = await ResolvePaymentMethodAsync(userId.Value, bookingDto.Payment, cancellationToken);
        if (paymentMethod.Error is not null) return BadRequest(paymentMethod.Error);

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
        var cancelledAt = DateTime.UtcNow;
        var previousAwaitingBookings = await db.TaxiBookings
            .Where(booking => booking.UserId == userId.Value && booking.Status == TaxiBookingStatus.AwaitingDriver)
            .ToListAsync(cancellationToken);
        foreach (var previousBooking in previousAwaitingBookings)
        {
            previousBooking.Status = TaxiBookingStatus.Cancelled;
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
            Status = TaxiBookingStatus.AwaitingDriver,
            PaymentToken = paymentMethod.Token,
            SavedCardLast4 = paymentMethod.Last4
        };

        db.TaxiBookings.Add(taxiBooking);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetTaxiBookings), ToResponse(taxiBooking));
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> CancelTaxiBooking(int id, CancellationToken cancellationToken)
    {
        var taxiBooking = await db.TaxiBookings.FindAsync([id], cancellationToken);
        if (taxiBooking is null) return NotFound();
        if (!CanAccess(taxiBooking)) return Forbid();
        if (taxiBooking.Status != TaxiBookingStatus.AwaitingDriver)
        {
            return Conflict("Only taxi bookings waiting for a driver can be cancelled.");
        }

        taxiBooking.Status = TaxiBookingStatus.Cancelled;
        taxiBooking.CancelledAt = DateTime.UtcNow;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("This ride was updated and could not be cancelled. Refresh its status.");
        }
        return NoContent();
    }

    private async Task<PaymentMethodResult> ResolvePaymentMethodAsync(int userId, BookingPaymentDto payment, CancellationToken cancellationToken)
    {
        if (payment.SavedPaymentCardId is not null)
        {
            var savedCard = await db.SavedPaymentCards.AsNoTracking()
                .FirstOrDefaultAsync(card => card.Id == payment.SavedPaymentCardId.Value && card.UserId == userId, cancellationToken);
            if (savedCard is null) return new PaymentMethodResult(null, null, "Saved payment card does not exist.");
            if (PaymentCardRules.IsExpired(savedCard.ExpiryMonth, savedCard.ExpiryYear))
            {
                return new PaymentMethodResult(null, null, "Saved payment card is expired.");
            }

            return new PaymentMethodResult(savedCard.Token, savedCard.Last4, null);
        }

        var validationError = PaymentCardRules.CreateCard(
            payment.CardNumber,
            payment.CardHolderName,
            payment.ExpiryMonth,
            payment.ExpiryYear,
            payment.Cvv,
            out var cardDraft);
        if (validationError is not null) return new PaymentMethodResult(null, null, validationError);

        if (payment.SaveCard)
        {
            db.SavedPaymentCards.Add(new SavedPaymentCard
            {
                UserId = userId,
                CardHolderName = cardDraft.CardHolderName,
                Brand = cardDraft.Brand,
                Last4 = cardDraft.Last4,
                ExpiryMonth = cardDraft.ExpiryMonth,
                ExpiryYear = cardDraft.ExpiryYear,
                Token = cardDraft.Token
            });
        }

        return new PaymentMethodResult(cardDraft.Token, cardDraft.Last4, null);
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
        SavedCardLast4 = booking.SavedCardLast4,
        DriverId = booking.DriverId,
        DriverName = booking.Driver?.Name,
        DriverPhoneNumber = booking.Driver?.PhoneNumber,
        AcceptedAt = booking.AcceptedAt,
        ArrivedAt = booking.ArrivedAt,
        CompletedAt = booking.CompletedAt,
        Rating = booking.Rating,
        ReviewComment = booking.ReviewComment,
        ReviewedAt = booking.ReviewedAt
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

    private sealed record PaymentMethodResult(string? Token, string? Last4, string? Error);
}

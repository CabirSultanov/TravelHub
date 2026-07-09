using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/booking-requests")]
public class BookingRequestsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<BookingRequestResponseDto>>> GetBookingRequests(int? hotelRoomId)
    {
        var query = db.BookingRequests.AsNoTracking();

        if (!IsAdmin())
        {
            var userId = GetCurrentUserId();

            if (userId is null)
            {
                return Unauthorized();
            }

            query = query.Where(booking => booking.UserId == userId.Value);
        }

        if (hotelRoomId is not null)
        {
            query = query.Where(booking => booking.HotelRoomId == hotelRoomId.Value);
        }

        return await query
            .Select(booking => new BookingRequestResponseDto
            {
                Id = booking.Id,
                UserId = booking.UserId,
                HotelRoomId = booking.HotelRoomId,
                HotelId = booking.HotelRoom.HotelId,
                RoomType = booking.HotelRoom.RoomType,
                CustomerName = booking.CustomerName,
                PhoneNumber = booking.PhoneNumber,
                Email = booking.Email,
                CheckInDate = booking.CheckInDate,
                CheckOutDate = booking.CheckOutDate,
                GuestsCount = booking.GuestsCount,
                Status = booking.Status.ToString(),
                PaidAt = booking.PaidAt,
                CancelledAt = booking.CancelledAt,
                SavedCardLast4 = booking.SavedCardLast4,
                TotalPrice = booking.TotalPrice
            })
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BookingRequestResponseDto>> GetBookingRequest(int id)
    {
        var query = db.BookingRequests.AsNoTracking()
            .Where(booking => booking.Id == id);

        if (!IsAdmin())
        {
            var userId = GetCurrentUserId();

            if (userId is null)
            {
                return Unauthorized();
            }

            query = query.Where(booking => booking.UserId == userId.Value);
        }

        var booking = await query
            .Select(booking => new BookingRequestResponseDto
            {
                Id = booking.Id,
                UserId = booking.UserId,
                HotelRoomId = booking.HotelRoomId,
                HotelId = booking.HotelRoom.HotelId,
                RoomType = booking.HotelRoom.RoomType,
                CustomerName = booking.CustomerName,
                PhoneNumber = booking.PhoneNumber,
                Email = booking.Email,
                CheckInDate = booking.CheckInDate,
                CheckOutDate = booking.CheckOutDate,
                GuestsCount = booking.GuestsCount,
                Status = booking.Status.ToString(),
                PaidAt = booking.PaidAt,
                CancelledAt = booking.CancelledAt,
                SavedCardLast4 = booking.SavedCardLast4,
                TotalPrice = booking.TotalPrice
            })
            .FirstOrDefaultAsync();

        if (booking is null)
        {
            return NotFound();
        }

        return booking;
    }

    [HttpPost]
    public async Task<ActionResult<BookingRequestResponseDto>> CreateBookingRequest(BookingRequestCreateDto bookingDto)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(bookingDto.CustomerName) || string.IsNullOrWhiteSpace(bookingDto.PhoneNumber) || string.IsNullOrWhiteSpace(bookingDto.Email))
        {
            return BadRequest("CustomerName, PhoneNumber and Email are required.");
        }

        if (bookingDto.CheckOutDate <= bookingDto.CheckInDate)
        {
            return BadRequest("CheckOutDate must be after CheckInDate.");
        }

        if (bookingDto.GuestsCount <= 0)
        {
            return BadRequest("GuestsCount must be greater than 0.");
        }

        var room = await db.HotelRooms.AsNoTracking().FirstOrDefaultAsync(room => room.Id == bookingDto.HotelRoomId);

        if (room is null)
        {
            return BadRequest("Hotel room does not exist.");
        }

        if (!room.IsAvailable)
        {
            return BadRequest("Hotel room is not available.");
        }

        if (bookingDto.GuestsCount > room.Capacity)
        {
            return BadRequest("GuestsCount cannot be greater than room capacity.");
        }

        var activeBookings = await db.BookingRequests.CountAsync(booking =>
            booking.HotelRoomId == bookingDto.HotelRoomId
            && booking.Status != BookingStatus.Cancelled
            && booking.CheckInDate < bookingDto.CheckOutDate
            && bookingDto.CheckInDate < booking.CheckOutDate);

        if (activeBookings >= room.TotalRooms)
        {
            return Conflict("No rooms available for selected dates.");
        }

        var nights = bookingDto.CheckOutDate.DayNumber - bookingDto.CheckInDate.DayNumber;
        var bookingRequest = new BookingRequest
        {
            UserId = userId.Value,
            HotelRoomId = bookingDto.HotelRoomId,
            CustomerName = bookingDto.CustomerName.Trim(),
            PhoneNumber = bookingDto.PhoneNumber.Trim(),
            Email = bookingDto.Email.Trim(),
            CheckInDate = bookingDto.CheckInDate,
            CheckOutDate = bookingDto.CheckOutDate,
            GuestsCount = bookingDto.GuestsCount,
            Status = BookingStatus.PendingPayment,
            TotalPrice = nights * room.PricePerNight
        };

        db.BookingRequests.Add(bookingRequest);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBookingRequest), new { id = bookingRequest.Id }, ToResponse(bookingRequest, room));
    }

    [HttpPost("{id:int}/pay")]
    public async Task<ActionResult<BookingRequestResponseDto>> PayBookingRequest(int id, BookingPaymentDto paymentDto)
    {
        var booking = await db.BookingRequests
            .Include(booking => booking.HotelRoom)
            .FirstOrDefaultAsync(booking => booking.Id == id);

        if (booking is null)
        {
            return NotFound();
        }

        if (!CanAccess(booking))
        {
            return Forbid();
        }

        if (booking.Status != BookingStatus.PendingPayment)
        {
            return Conflict("Only pending bookings can be paid.");
        }

        var cardDigits = new string(paymentDto.CardNumber.Where(char.IsDigit).ToArray());

        if (paymentDto.SaveCard && cardDigits.Length < 4)
        {
            return BadRequest("CardNumber must contain at least 4 digits to save card.");
        }

        booking.Status = BookingStatus.Paid;
        booking.PaidAt = DateTime.UtcNow;
        booking.SavedCardLast4 = paymentDto.SaveCard ? cardDigits[^4..] : null;

        await db.SaveChangesAsync();

        return ToResponse(booking, booking.HotelRoom);
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> CancelBookingRequest(int id)
    {
        var booking = await db.BookingRequests.FindAsync(id);

        if (booking is null)
        {
            return NotFound();
        }

        if (!CanAccess(booking))
        {
            return Forbid();
        }

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static BookingRequestResponseDto ToResponse(BookingRequest booking, HotelRoom room) => new()
    {
        Id = booking.Id,
        UserId = booking.UserId,
        HotelRoomId = booking.HotelRoomId,
        HotelId = room.HotelId,
        RoomType = room.RoomType,
        CustomerName = booking.CustomerName,
        PhoneNumber = booking.PhoneNumber,
        Email = booking.Email,
        CheckInDate = booking.CheckInDate,
        CheckOutDate = booking.CheckOutDate,
        GuestsCount = booking.GuestsCount,
        Status = booking.Status.ToString(),
        PaidAt = booking.PaidAt,
        CancelledAt = booking.CancelledAt,
        SavedCardLast4 = booking.SavedCardLast4,
        TotalPrice = booking.TotalPrice
    };

    private bool IsAdmin() => User.IsInRole(UserRoles.Admin) || User.IsInRole(UserRoles.SuperAdmin);

    private bool CanAccess(BookingRequest booking)
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

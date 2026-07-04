using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/booking-requests")]
public class BookingRequestsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<BookingRequestResponseDto>>> GetBookingRequests(int? hotelRoomId)
    {
        var query = db.BookingRequests.AsNoTracking();

        if (hotelRoomId is not null)
        {
            query = query.Where(booking => booking.HotelRoomId == hotelRoomId.Value);
        }

        return await query
            .Select(booking => new BookingRequestResponseDto
            {
                Id = booking.Id,
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
                TotalPrice = booking.TotalPrice
            })
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BookingRequestResponseDto>> GetBookingRequest(int id)
    {
        var booking = await db.BookingRequests.AsNoTracking()
            .Where(booking => booking.Id == id)
            .Select(booking => new BookingRequestResponseDto
            {
                Id = booking.Id,
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

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> CancelBookingRequest(int id)
    {
        var booking = await db.BookingRequests.FindAsync(id);

        if (booking is null)
        {
            return NotFound();
        }

        booking.Status = BookingStatus.Cancelled;
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static BookingRequestResponseDto ToResponse(BookingRequest booking, HotelRoom room) => new()
    {
        Id = booking.Id,
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
        TotalPrice = booking.TotalPrice
    };
}

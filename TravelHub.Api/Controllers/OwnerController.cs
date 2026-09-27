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
[Authorize(Roles = UserRoles.HotelOwner)]
[Route("api/owner")]
public class OwnerController(AppDbContext db, TimeProvider? timeProvider = null) : ControllerBase
{
    [HttpGet("hotels")]
    public async Task<ActionResult<PagedResponseDto<HotelResponseDto>>> GetHotels(string? search = null, int page = 1, int pageSize = 20)
    {
        var ownerId = await GetOwnerIdAsync();
        if (ownerId is null) return Forbid();

        var query = db.Hotels.AsNoTracking().Where(hotel => hotel.OwnerId == ownerId.Value);
        var term = search?.Trim().ToLower();
        if (!string.IsNullOrEmpty(term))
            query = query.Where(hotel => hotel.Name.ToLower().Contains(term) || hotel.City.ToLower().Contains(term));

        var response = Page<HotelResponseDto>(await query.CountAsync(), page, pageSize);
        response.Items = await query.OrderBy(hotel => hotel.Id)
            .Skip((response.Page - 1) * response.PageSize).Take(response.PageSize)
            .Select(hotel => new HotelResponseDto
            {
                Id = hotel.Id,
                Name = hotel.Name,
                City = hotel.City,
                Description = hotel.Description,
                ImageUrl = hotel.ImageUrl,
                ImageUrls = HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl),
                OwnerId = hotel.OwnerId,
                RoomTypesCount = db.HotelRooms.Count(room => room.HotelId == hotel.Id),
                TotalRoomsCount = db.HotelRooms.Where(room => room.HotelId == hotel.Id).Sum(room => (int?)room.TotalRooms) ?? 0,
                TotalGuestPlaces = db.HotelRooms.Where(room => room.HotelId == hotel.Id).Sum(room => (int?)(room.Capacity * room.TotalRooms)) ?? 0,
                AverageRating = db.HotelReviews.Where(review => review.HotelId == hotel.Id).Average(review => (double?)review.Rating),
                ReviewCount = db.HotelReviews.Count(review => review.HotelId == hotel.Id)
            }).ToListAsync();
        foreach (var hotel in response.Items) hotel.ImageUrl ??= hotel.ImageUrls.FirstOrDefault();
        return response;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<OwnerOverviewDto>> GetOverview(int? hotelId = null)
    {
        var ownerId = await GetOwnerIdAsync();
        if (ownerId is null) return Forbid();
        if (!await CanReadHotelAsync(ownerId.Value, hotelId)) return NotFound();

        var today = Today();
        var query = Bookings(ownerId.Value, hotelId);
        return new OwnerOverviewDto
        {
            Today = today,
            ArrivalsToday = await query.CountAsync(booking => booking.Status == BookingStatus.Paid && booking.CheckInDate == today),
            DeparturesToday = await query.CountAsync(booking => booking.Status == BookingStatus.Paid && booking.CheckOutDate == today),
            AwaitingPayment = await query.CountAsync(booking => booking.Status == BookingStatus.PendingPayment && booking.CheckOutDate > today),
            UpcomingArrivals = await Responses(query.Where(booking => booking.Status == BookingStatus.Paid && booking.CheckInDate >= today)
                .OrderBy(booking => booking.CheckInDate).ThenBy(booking => booking.Id).Take(5)).ToListAsync()
        };
    }

    [HttpGet("bookings")]
    public async Task<ActionResult<PagedResponseDto<OwnerBookingDto>>> GetBookings(
        int? hotelId = null, string? search = null, string? status = null, string period = "upcoming", int page = 1, int pageSize = 20,
        DateOnly? from = null, DateOnly? to = null)
    {
        var ownerId = await GetOwnerIdAsync();
        if (ownerId is null) return Forbid();
        if (!await CanReadHotelAsync(ownerId.Value, hotelId)) return NotFound();
        if (from is not null && to is not null && from > to)
            return BadRequest("From date cannot be after to date.");

        var query = Bookings(ownerId.Value, hotelId);
        if (from is not null) query = query.Where(booking => booking.CheckOutDate > from.Value);
        if (to is not null) query = query.Where(booking => booking.CheckInDate <= to.Value);
        if (status is not null)
        {
            if (status is not (nameof(BookingStatus.PendingPayment) or nameof(BookingStatus.Paid) or nameof(BookingStatus.Cancelled)))
                return BadRequest("Status must be PendingPayment, Paid or Cancelled.");
            var bookingStatus = Enum.Parse<BookingStatus>(status);
            query = query.Where(booking => booking.Status == bookingStatus);
        }

        var today = Today();
        switch (period)
        {
            case "upcoming": query = query.Where(booking => booking.CheckOutDate > today); break;
            case "past": query = query.Where(booking => booking.CheckOutDate <= today); break;
            case "arrivals": query = query.Where(booking => booking.CheckInDate == today); break;
            case "departures": query = query.Where(booking => booking.CheckOutDate == today); break;
            case "all": break;
            default: return BadRequest("Period must be upcoming, past, all, arrivals or departures.");
        }

        var term = search?.Trim().ToLower();
        if (!string.IsNullOrEmpty(term))
        {
            var bookingId = int.TryParse(term, out var id) ? id : -1;
            query = query.Where(booking => booking.Id == bookingId || booking.CustomerName.ToLower().Contains(term)
                || booking.PhoneNumber.ToLower().Contains(term) || booking.Email.ToLower().Contains(term)
                || booking.HotelRoom.Hotel.Name.ToLower().Contains(term) || booking.HotelRoom.RoomType.ToLower().Contains(term));
        }

        var response = Page<OwnerBookingDto>(await query.CountAsync(), page, pageSize);
        response.Items = await Responses(query.OrderBy(booking => booking.CheckInDate).ThenBy(booking => booking.Id)
            .Skip((response.Page - 1) * response.PageSize).Take(response.PageSize)).ToListAsync();
        return response;
    }

    [HttpGet("bookings/{id:int}")]
    public async Task<ActionResult<OwnerBookingDto>> GetBooking(int id)
    {
        var ownerId = await GetOwnerIdAsync();
        if (ownerId is null) return Forbid();
        var booking = await Responses(Bookings(ownerId.Value, null).Where(booking => booking.Id == id)).SingleOrDefaultAsync();
        return booking is null ? NotFound() : booking;
    }

    private async Task<int?> GetOwnerIdAsync()
    {
        if (!User.IsInRole(UserRoles.HotelOwner) || !int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return null;
        return await db.Users.AsNoTracking()
            .Where(user => user.Id == userId && user.Role == UserRoles.HotelOwner && !user.IsBlocked)
            .Select(user => (int?)user.Id).SingleOrDefaultAsync();
    }

    private Task<bool> CanReadHotelAsync(int ownerId, int? hotelId) => hotelId is null
        ? Task.FromResult(true)
        : db.Hotels.AnyAsync(hotel => hotel.Id == hotelId.Value && hotel.OwnerId == ownerId);

    private IQueryable<BookingRequest> Bookings(int ownerId, int? hotelId) => db.BookingRequests.AsNoTracking()
        .Where(booking => booking.HotelRoom.Hotel.OwnerId == ownerId && (hotelId == null || booking.HotelRoom.HotelId == hotelId));

    private DateOnly Today() => HotelBookingRules.TodayInBaku((timeProvider ?? TimeProvider.System).GetUtcNow());

    private static PagedResponseDto<T> Page<T>(int totalItems, int page, int pageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        return new PagedResponseDto<T>
        {
            Page = totalPages == 0 ? 1 : Math.Clamp(page, 1, totalPages),
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    private static IQueryable<OwnerBookingDto> Responses(IQueryable<BookingRequest> query) => query.Select(booking => new OwnerBookingDto
    {
        Id = booking.Id,
        HotelId = booking.HotelRoom.HotelId,
        HotelRoomId = booking.HotelRoomId,
        HotelName = booking.HotelRoom.Hotel.Name,
        RoomType = booking.HotelRoom.RoomType,
        CustomerName = booking.CustomerName,
        PhoneNumber = booking.PhoneNumber,
        Email = booking.Email,
        CheckInDate = booking.CheckInDate,
        CheckOutDate = booking.CheckOutDate,
        Status = booking.Status.ToString(),
        PaidAt = booking.PaidAt,
        CancelledAt = booking.CancelledAt,
        TotalPrice = booking.TotalPrice
    });
}

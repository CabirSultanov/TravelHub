using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/hotels")]
public class HotelsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<HotelResponseDto>>> GetHotels()
    {
        return await HotelsWithStats().ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HotelResponseDto>> GetHotel(int id)
    {
        var hotel = await HotelsWithStats().FirstOrDefaultAsync(hotel => hotel.Id == id);

        if (hotel is null)
        {
            return NotFound();
        }

        return hotel;
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpPost]
    public async Task<ActionResult<Hotel>> CreateHotel(HotelCreateDto hotelDto)
    {
        if (string.IsNullOrWhiteSpace(hotelDto.Name) || string.IsNullOrWhiteSpace(hotelDto.City))
        {
            return BadRequest("Name and City are required.");
        }

        var name = hotelDto.Name.Trim();

        if (await db.Hotels.AnyAsync(hotel => hotel.Name.Trim() == name))
        {
            return Conflict("Hotel with this name already exists.");
        }

        var roomTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var roomDrafts = new List<HotelRoomDraft>();
        var hotelRooms = new List<HotelRoom>();

        var hotel = new Hotel
        {
            Name = name,
            City = hotelDto.City.Trim(),
            Description = hotelDto.Description,
            ImageUrl = hotelDto.ImageUrl
        };

        foreach (var roomDto in hotelDto.Rooms ?? new List<HotelCreateRoomDto>())
        {
            var validationError = HotelRoomRules.ValidateRoom(
                roomDto.RoomType,
                roomDto.Capacity,
                roomDto.TotalRooms,
                roomDto.PricePerNight);

            if (validationError is not null)
            {
                return BadRequest(validationError);
            }

            var roomType = roomDto.RoomType.Trim();

            if (!roomTypes.Add(roomType))
            {
                return Conflict("Room type already exists for this hotel.");
            }

            var imageUrls = HotelRoomRules.NormalizeImageUrls(roomDto.ImageUrls, null, out var imageError);

            if (imageError is not null)
            {
                return BadRequest(imageError);
            }

            roomDrafts.Add(new HotelRoomDraft(roomType, roomDto.Capacity, roomDto.TotalRooms));
            hotelRooms.Add(new HotelRoom
            {
                RoomType = roomType,
                Capacity = roomDto.Capacity,
                TotalRooms = roomDto.TotalRooms,
                PricePerNight = roomDto.PricePerNight,
                Description = roomDto.Description,
                ImageUrl = imageUrls.FirstOrDefault(),
                ImageUrlsJson = HotelRoomRules.ToJson(imageUrls),
                IsAvailable = roomDto.IsAvailable
            });
        }

        var roomSetError = HotelRoomRules.ValidateRoomSet(roomDrafts);

        if (roomSetError is not null)
        {
            return BadRequest(roomSetError);
        }

        await using var transaction = await db.Database.BeginTransactionAsync();

        db.Hotels.Add(hotel);
        await db.SaveChangesAsync();

        foreach (var room in hotelRooms)
        {
            room.HotelId = hotel.Id;
        }

        db.HotelRooms.AddRange(hotelRooms);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return CreatedAtAction(nameof(GetHotel), new { id = hotel.Id }, ToResponse(hotel, hotelRooms));
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateHotel(int id, HotelUpdateDto hotelDto)
    {
        if (string.IsNullOrWhiteSpace(hotelDto.Name) || string.IsNullOrWhiteSpace(hotelDto.City))
        {
            return BadRequest("Name and City are required.");
        }

        var hotel = await db.Hotels.FindAsync(id);

        if (hotel is null)
        {
            return NotFound();
        }

        var name = hotelDto.Name.Trim();

        if (await db.Hotels.AnyAsync(hotel => hotel.Id != id && hotel.Name.Trim() == name))
        {
            return Conflict("Hotel with this name already exists.");
        }

        hotel.Name = name;
        hotel.City = hotelDto.City.Trim();
        hotel.Description = hotelDto.Description;
        hotel.ImageUrl = hotelDto.ImageUrl;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteHotel(int id)
    {
        var hotel = await db.Hotels.FindAsync(id);

        if (hotel is null)
        {
            return NotFound();
        }

        db.Hotels.Remove(hotel);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private IQueryable<HotelResponseDto> HotelsWithStats() =>
        db.Hotels.AsNoTracking()
            .Select(hotel => new HotelResponseDto
            {
                Id = hotel.Id,
                Name = hotel.Name,
                City = hotel.City,
                Description = hotel.Description,
                ImageUrl = hotel.ImageUrl,
                RoomTypesCount = db.HotelRooms.Count(room => room.HotelId == hotel.Id),
                TotalRoomsCount = db.HotelRooms
                    .Where(room => room.HotelId == hotel.Id)
                    .Sum(room => (int?)room.TotalRooms) ?? 0,
                TotalGuestPlaces = db.HotelRooms
                    .Where(room => room.HotelId == hotel.Id)
                    .Sum(room => (int?)(room.Capacity * room.TotalRooms)) ?? 0
            });

    private static HotelResponseDto ToResponse(Hotel hotel, IEnumerable<HotelRoom> rooms) => new()
    {
        Id = hotel.Id,
        Name = hotel.Name,
        City = hotel.City,
        Description = hotel.Description,
        ImageUrl = hotel.ImageUrl,
        RoomTypesCount = rooms.Count(),
        TotalRoomsCount = rooms.Sum(room => room.TotalRooms),
        TotalGuestPlaces = rooms.Sum(room => room.Capacity * room.TotalRooms)
    };
}

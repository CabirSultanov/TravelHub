using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/hotel-rooms")]
public class HotelRoomsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<HotelRoomResponseDto>>> GetHotelRooms(int? hotelId)
    {
        var query = db.HotelRooms.AsNoTracking();

        if (hotelId is not null)
        {
            query = query.Where(room => room.HotelId == hotelId.Value);
        }

        return await query.Select(room => new HotelRoomResponseDto
        {
            Id = room.Id,
            HotelId = room.HotelId,
            RoomType = room.RoomType,
            Capacity = room.Capacity,
            TotalRooms = room.TotalRooms,
            PricePerNight = room.PricePerNight,
            Description = room.Description,
            ImageUrl = room.ImageUrl,
            IsAvailable = room.IsAvailable
        }).ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HotelRoomResponseDto>> GetHotelRoom(int id)
    {
        var room = await db.HotelRooms.AsNoTracking()
            .Where(room => room.Id == id)
            .Select(room => new HotelRoomResponseDto
            {
                Id = room.Id,
                HotelId = room.HotelId,
                RoomType = room.RoomType,
                Capacity = room.Capacity,
                TotalRooms = room.TotalRooms,
                PricePerNight = room.PricePerNight,
                Description = room.Description,
                ImageUrl = room.ImageUrl,
                IsAvailable = room.IsAvailable
            })
            .FirstOrDefaultAsync();

        if (room is null)
        {
            return NotFound();
        }

        return room;
    }

    [HttpPost]
    public async Task<ActionResult<HotelRoomResponseDto>> CreateHotelRoom(HotelRoomCreateDto roomDto)
    {
        if (string.IsNullOrWhiteSpace(roomDto.RoomType))
        {
            return BadRequest("RoomType is required.");
        }

        if (roomDto.Capacity <= 0)
        {
            return BadRequest("Capacity must be greater than 0.");
        }

        if (roomDto.TotalRooms <= 0)
        {
            return BadRequest("TotalRooms must be greater than 0.");
        }

        if (roomDto.PricePerNight < 0)
        {
            return BadRequest("PricePerNight cannot be negative.");
        }

        if (!await db.Hotels.AnyAsync(hotel => hotel.Id == roomDto.HotelId))
        {
            return BadRequest("Hotel does not exist.");
        }

        var roomType = roomDto.RoomType.Trim();

        if (await db.HotelRooms.AnyAsync(room => room.HotelId == roomDto.HotelId && room.RoomType.Trim() == roomType))
        {
            return Conflict("Room type already exists for this hotel. Update TotalRooms instead.");
        }

        var room = new HotelRoom
        {
            HotelId = roomDto.HotelId,
            RoomType = roomType,
            Capacity = roomDto.Capacity,
            TotalRooms = roomDto.TotalRooms,
            PricePerNight = roomDto.PricePerNight,
            Description = roomDto.Description,
            ImageUrl = roomDto.ImageUrl,
            IsAvailable = roomDto.IsAvailable
        };

        db.HotelRooms.Add(room);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHotelRoom), new { id = room.Id }, ToResponse(room));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateHotelRoom(int id, HotelRoomUpdateDto roomDto)
    {
        if (string.IsNullOrWhiteSpace(roomDto.RoomType))
        {
            return BadRequest("RoomType is required.");
        }

        if (roomDto.Capacity <= 0)
        {
            return BadRequest("Capacity must be greater than 0.");
        }

        if (roomDto.TotalRooms <= 0)
        {
            return BadRequest("TotalRooms must be greater than 0.");
        }

        if (roomDto.PricePerNight < 0)
        {
            return BadRequest("PricePerNight cannot be negative.");
        }

        var room = await db.HotelRooms.FindAsync(id);

        if (room is null)
        {
            return NotFound();
        }

        if (!await db.Hotels.AnyAsync(hotel => hotel.Id == roomDto.HotelId))
        {
            return BadRequest("Hotel does not exist.");
        }

        var roomType = roomDto.RoomType.Trim();

        if (await db.HotelRooms.AnyAsync(room => room.Id != id && room.HotelId == roomDto.HotelId && room.RoomType.Trim() == roomType))
        {
            return Conflict("Room type already exists for this hotel. Update TotalRooms instead.");
        }

        room.HotelId = roomDto.HotelId;
        room.RoomType = roomType;
        room.Capacity = roomDto.Capacity;
        room.TotalRooms = roomDto.TotalRooms;
        room.PricePerNight = roomDto.PricePerNight;
        room.Description = roomDto.Description;
        room.ImageUrl = roomDto.ImageUrl;
        room.IsAvailable = roomDto.IsAvailable;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteHotelRoom(int id)
    {
        var room = await db.HotelRooms.FindAsync(id);

        if (room is null)
        {
            return NotFound();
        }

        db.HotelRooms.Remove(room);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static HotelRoomResponseDto ToResponse(HotelRoom room) => new()
    {
        Id = room.Id,
        HotelId = room.HotelId,
        RoomType = room.RoomType,
        Capacity = room.Capacity,
        TotalRooms = room.TotalRooms,
        PricePerNight = room.PricePerNight,
        Description = room.Description,
        ImageUrl = room.ImageUrl,
        IsAvailable = room.IsAvailable
    };
}

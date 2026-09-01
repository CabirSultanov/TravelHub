using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/hotel-rooms")]
public class HotelRoomsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<HotelRoomResponseDto>>> GetHotelRooms([FromQuery] int? hotelId)
    {
        var query = db.HotelRooms.AsNoTracking();

        if (hotelId is not null)
        {
            query = query.Where(room => room.HotelId == hotelId.Value);
        }

        var rooms = await query.ToListAsync();
        return rooms.Select(ToResponse).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HotelRoomResponseDto>> GetHotelRoom(int id)
    {
        var room = await db.HotelRooms.AsNoTracking().FirstOrDefaultAsync(room => room.Id == id);

        if (room is null)
        {
            return NotFound();
        }

        return ToResponse(room);
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdminOrHotelOwner)]
    [HttpPost]
    public async Task<ActionResult<HotelRoomResponseDto>> CreateHotelRoom(HotelRoomCreateDto roomDto)
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

        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(hotel => hotel.Id == roomDto.HotelId);

        if (hotel is null)
        {
            return BadRequest("Hotel does not exist.");
        }

        if (!OwnershipRules.CanManageHotel(User, hotel))
        {
            return Forbid();
        }

        var roomType = roomDto.RoomType.Trim();

        if (await db.HotelRooms.AnyAsync(room => room.HotelId == roomDto.HotelId && room.RoomType.Trim() == roomType))
        {
            return Conflict("Room type already exists for this hotel. Update TotalRooms instead.");
        }

        var imageUrls = HotelRoomRules.NormalizeImageUrls(roomDto.ImageUrls, roomDto.ImageUrl, out var imageError);

        if (imageError is not null)
        {
            return BadRequest(imageError);
        }

        var room = new HotelRoom
        {
            HotelId = roomDto.HotelId,
            RoomType = roomType,
            Capacity = roomDto.Capacity,
            TotalRooms = roomDto.TotalRooms,
            PricePerNight = roomDto.PricePerNight,
            Description = roomDto.Description,
            ImageUrl = imageUrls.FirstOrDefault(),
            ImageUrlsJson = HotelRoomRules.ToJson(imageUrls),
            IsAvailable = roomDto.IsAvailable
        };

        db.HotelRooms.Add(room);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHotelRoom), new { id = room.Id }, ToResponse(room));
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdminOrHotelOwner)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateHotelRoom(int id, HotelRoomUpdateDto roomDto)
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

        var room = await db.HotelRooms.FindAsync(id);

        if (room is null)
        {
            return NotFound();
        }

        var sourceHotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(hotel => hotel.Id == room.HotelId);

        if (sourceHotel is null)
        {
            return BadRequest("Hotel does not exist.");
        }

        if (!OwnershipRules.CanManageHotel(User, sourceHotel))
        {
            return Forbid();
        }

        if (!OwnershipRules.IsAdministrator(User) && room.HotelId != roomDto.HotelId)
        {
            return Forbid();
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

        var nextRoom = new HotelRoomDraft(roomType, roomDto.Capacity, roomDto.TotalRooms);
        var targetRoomSetError = await ValidateHotelRoomsAsync(roomDto.HotelId, nextRoom, room.Id);

        if (targetRoomSetError is not null)
        {
            return Conflict(targetRoomSetError);
        }

        if (room.HotelId != roomDto.HotelId)
        {
            var sourceRoomSetError = await ValidateHotelRoomsAsync(room.HotelId, null, room.Id);

            if (sourceRoomSetError is not null)
            {
                return Conflict(sourceRoomSetError);
            }
        }

        var imageUrls = HotelRoomRules.NormalizeImageUrls(roomDto.ImageUrls, roomDto.ImageUrl, out var imageError);

        if (imageError is not null)
        {
            return BadRequest(imageError);
        }

        room.HotelId = roomDto.HotelId;
        room.RoomType = roomType;
        room.Capacity = roomDto.Capacity;
        room.TotalRooms = roomDto.TotalRooms;
        room.PricePerNight = roomDto.PricePerNight;
        room.Description = roomDto.Description;
        room.ImageUrl = imageUrls.FirstOrDefault();
        room.ImageUrlsJson = HotelRoomRules.ToJson(imageUrls);
        room.IsAvailable = roomDto.IsAvailable;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdminOrHotelOwner)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteHotelRoom(int id)
    {
        var room = await db.HotelRooms.FindAsync(id);

        if (room is null)
        {
            return NotFound();
        }

        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(hotel => hotel.Id == room.HotelId);

        if (hotel is null)
        {
            return BadRequest("Hotel does not exist.");
        }

        if (!OwnershipRules.CanManageHotel(User, hotel))
        {
            return Forbid();
        }

        var roomSetError = await ValidateHotelRoomsAsync(room.HotelId, null, room.Id);

        if (roomSetError is not null)
        {
            return Conflict(roomSetError);
        }

        db.HotelRooms.Remove(room);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string?> ValidateHotelRoomsAsync(int hotelId, HotelRoomDraft? nextRoom, int? excludedRoomId = null)
    {
        var query = db.HotelRooms.AsNoTracking().Where(room => room.HotelId == hotelId);

        if (excludedRoomId is not null)
        {
            query = query.Where(room => room.Id != excludedRoomId.Value);
        }

        var roomRows = await query
            .Select(room => new { room.RoomType, room.Capacity, room.TotalRooms })
            .ToListAsync();
        var drafts = roomRows
            .Select(room => new HotelRoomDraft(room.RoomType, room.Capacity, room.TotalRooms))
            .ToList();

        if (nextRoom is not null)
        {
            drafts.Add(nextRoom.Value);
        }

        return HotelRoomRules.ValidateRoomSet(drafts);
    }

    private static HotelRoomResponseDto ToResponse(HotelRoom room)
    {
        var imageUrls = HotelRoomRules.FromJson(room.ImageUrlsJson, room.ImageUrl);

        return new HotelRoomResponseDto
        {
            Id = room.Id,
            HotelId = room.HotelId,
            RoomType = room.RoomType,
            Capacity = room.Capacity,
            TotalRooms = room.TotalRooms,
            PricePerNight = room.PricePerNight,
            Description = room.Description,
            ImageUrl = room.ImageUrl ?? imageUrls.FirstOrDefault(),
            ImageUrls = imageUrls,
            IsAvailable = room.IsAvailable
        };
    }
}

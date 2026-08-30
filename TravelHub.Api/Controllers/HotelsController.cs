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
    private const int DefaultHotelPageSize = 3;
    private const int MaxHotelPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedResponseDto<HotelResponseDto>>> GetHotels(int page = 1, int pageSize = DefaultHotelPageSize, string? city = null)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, MaxHotelPageSize);
        var query = db.Hotels.AsNoTracking();
        var cityFilter = city?.Trim();

        if (!string.IsNullOrWhiteSpace(cityFilter))
        {
            query = query.Where(hotel => hotel.City == cityFilter);
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)normalizedPageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(normalizedPage, totalPages);
        var rows = await HotelsWithStats(query)
            .OrderBy(hotel => hotel.Id)
            .Skip((effectivePage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync();

        return new PagedResponseDto<HotelResponseDto>
        {
            Items = rows.Select(ToResponse).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    [HttpGet("cities")]
    public async Task<ActionResult<List<string>>> GetHotelCities()
    {
        return await db.Hotels.AsNoTracking()
            .Select(hotel => hotel.City.Trim())
            .Where(city => city != string.Empty)
            .Distinct()
            .OrderBy(city => city)
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HotelResponseDto>> GetHotel(int id)
    {
        var hotel = await HotelsWithStats(db.Hotels.AsNoTracking().Where(hotel => hotel.Id == id))
            .FirstOrDefaultAsync();

        if (hotel is null)
        {
            return NotFound();
        }

        return ToResponse(hotel);
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

        var imageUrls = HotelRoomRules.NormalizeImageUrls(hotelDto.ImageUrls, hotelDto.ImageUrl, out var imageError);

        if (imageError is not null)
        {
            return BadRequest(imageError);
        }

        var hotel = new Hotel
        {
            Name = name,
            City = hotelDto.City.Trim(),
            Description = hotelDto.Description,
            ImageUrl = imageUrls.FirstOrDefault(),
            ImageUrlsJson = HotelRoomRules.ToJson(imageUrls)
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

            var roomImageUrls = HotelRoomRules.NormalizeImageUrls(roomDto.ImageUrls, null, out var roomImageError);

            if (roomImageError is not null)
            {
                return BadRequest(roomImageError);
            }

            roomDrafts.Add(new HotelRoomDraft(roomType, roomDto.Capacity, roomDto.TotalRooms));
            hotelRooms.Add(new HotelRoom
            {
                RoomType = roomType,
                Capacity = roomDto.Capacity,
                TotalRooms = roomDto.TotalRooms,
                PricePerNight = roomDto.PricePerNight,
                Description = roomDto.Description,
                ImageUrl = roomImageUrls.FirstOrDefault(),
                ImageUrlsJson = HotelRoomRules.ToJson(roomImageUrls),
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

        var imageUrls = HotelRoomRules.NormalizeImageUrls(hotelDto.ImageUrls, hotelDto.ImageUrl, out var imageError);

        if (imageError is not null)
        {
            return BadRequest(imageError);
        }

        hotel.Name = name;
        hotel.City = hotelDto.City.Trim();
        hotel.Description = hotelDto.Description;
        hotel.ImageUrl = imageUrls.FirstOrDefault();
        hotel.ImageUrlsJson = HotelRoomRules.ToJson(imageUrls);

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

    private IQueryable<HotelResponseRow> HotelsWithStats(IQueryable<Hotel> hotels) =>
        hotels
            .Select(hotel => new HotelResponseRow
            {
                Id = hotel.Id,
                Name = hotel.Name,
                City = hotel.City,
                Description = hotel.Description,
                ImageUrl = hotel.ImageUrl,
                ImageUrlsJson = hotel.ImageUrlsJson,
                RoomTypesCount = db.HotelRooms.Count(room => room.HotelId == hotel.Id),
                TotalRoomsCount = db.HotelRooms
                    .Where(room => room.HotelId == hotel.Id)
                    .Sum(room => (int?)room.TotalRooms) ?? 0,
                TotalGuestPlaces = db.HotelRooms
                    .Where(room => room.HotelId == hotel.Id)
                    .Sum(room => (int?)(room.Capacity * room.TotalRooms)) ?? 0,
                AverageRating = db.HotelReviews
                    .Where(review => review.HotelId == hotel.Id)
                    .Average(review => (double?)review.Rating),
                ReviewCount = db.HotelReviews.Count(review => review.HotelId == hotel.Id)
            });

    private static HotelResponseDto ToResponse(HotelResponseRow row)
    {
        var imageUrls = HotelRoomRules.FromJson(row.ImageUrlsJson, row.ImageUrl);

        return new HotelResponseDto
        {
            Id = row.Id,
            Name = row.Name,
            City = row.City,
            Description = row.Description,
            ImageUrl = row.ImageUrl ?? imageUrls.FirstOrDefault(),
            ImageUrls = imageUrls,
            RoomTypesCount = row.RoomTypesCount,
            TotalRoomsCount = row.TotalRoomsCount,
            TotalGuestPlaces = row.TotalGuestPlaces,
            AverageRating = row.AverageRating,
            ReviewCount = row.ReviewCount
        };
    }

    private static HotelResponseDto ToResponse(Hotel hotel, IEnumerable<HotelRoom> rooms) => new()
    {
        Id = hotel.Id,
        Name = hotel.Name,
        City = hotel.City,
        Description = hotel.Description,
        ImageUrl = hotel.ImageUrl ?? HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl).FirstOrDefault(),
        ImageUrls = HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl),
        RoomTypesCount = rooms.Count(),
        TotalRoomsCount = rooms.Sum(room => room.TotalRooms),
        TotalGuestPlaces = rooms.Sum(room => room.Capacity * room.TotalRooms),
        AverageRating = null,
        ReviewCount = 0
    };

    private sealed class HotelResponseRow
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public string City { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string? ImageUrl { get; set; }

        public string ImageUrlsJson { get; set; } = "[]";

        public int RoomTypesCount { get; set; }

        public int TotalRoomsCount { get; set; }

        public int TotalGuestPlaces { get; set; }

        public double? AverageRating { get; set; }

        public int ReviewCount { get; set; }
    }
}

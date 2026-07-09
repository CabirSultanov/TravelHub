using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/hotels")]
public class HotelsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<Hotel>>> GetHotels()
    {
        return await db.Hotels.AsNoTracking().ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Hotel>> GetHotel(int id)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(hotel => hotel.Id == id);

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

        var hotel = new Hotel
        {
            Name = name,
            City = hotelDto.City.Trim(),
            Address = hotelDto.Address,
            PricePerNight = hotelDto.PricePerNight,
            Description = hotelDto.Description,
            ImageUrl = hotelDto.ImageUrl
        };

        db.Hotels.Add(hotel);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHotel), new { id = hotel.Id }, hotel);
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
        hotel.Address = hotelDto.Address;
        hotel.PricePerNight = hotelDto.PricePerNight;
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
}

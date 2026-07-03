using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("places")]
public class PlacesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<Place>>> GetPlaces()
    {
        return await db.Places.AsNoTracking().ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Place>> GetPlace(int id)
    {
        var place = await db.Places.AsNoTracking().FirstOrDefaultAsync(place => place.Id == id);

        if (place is null)
        {
            return NotFound();
        }

        return place;
    }

    [HttpPost]
    public async Task<ActionResult<Place>> CreatePlace(PlaceCreateDto placeDto)
    {
        if (string.IsNullOrWhiteSpace(placeDto.Name) || string.IsNullOrWhiteSpace(placeDto.City))
        {
            return BadRequest("Name and City are required.");
        }

        var place = new Place
        {
            Name = placeDto.Name,
            City = placeDto.City,
            Description = placeDto.Description,
            ImageUrl = placeDto.ImageUrl
        };

        db.Places.Add(place);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPlace), new { id = place.Id }, place);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdatePlace(int id, PlaceUpdateDto placeDto)
    {
        if (string.IsNullOrWhiteSpace(placeDto.Name) || string.IsNullOrWhiteSpace(placeDto.City))
        {
            return BadRequest("Name and City are required.");
        }

        var place = await db.Places.FindAsync(id);

        if (place is null)
        {
            return NotFound();
        }

        place.Name = placeDto.Name;
        place.City = placeDto.City;
        place.Description = placeDto.Description;
        place.ImageUrl = placeDto.ImageUrl;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePlace(int id)
    {
        var place = await db.Places.FindAsync(id);

        if (place is null)
        {
            return NotFound();
        }

        db.Places.Remove(place);
        await db.SaveChangesAsync();

        return NoContent();
    }
}

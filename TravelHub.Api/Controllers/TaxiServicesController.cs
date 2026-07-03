using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/taxi-services")]
public class TaxiServicesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<TaxiService>>> GetTaxiServices()
    {
        return await db.TaxiServices.AsNoTracking().ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaxiService>> GetTaxiService(int id)
    {
        var taxiService = await db.TaxiServices.AsNoTracking().FirstOrDefaultAsync(taxiService => taxiService.Id == id);

        if (taxiService is null)
        {
            return NotFound();
        }

        return taxiService;
    }

    [HttpPost]
    public async Task<ActionResult<TaxiService>> CreateTaxiService(TaxiServiceCreateDto taxiServiceDto)
    {
        if (string.IsNullOrWhiteSpace(taxiServiceDto.CompanyName) || string.IsNullOrWhiteSpace(taxiServiceDto.City) || string.IsNullOrWhiteSpace(taxiServiceDto.PhoneNumber))
        {
            return BadRequest("CompanyName, City and PhoneNumber are required.");
        }

        var companyName = taxiServiceDto.CompanyName.Trim();

        if (await db.TaxiServices.AnyAsync(taxiService => taxiService.CompanyName.Trim() == companyName))
        {
            return Conflict("Taxi service with this company name already exists.");
        }

        var taxiService = new TaxiService
        {
            CompanyName = companyName,
            City = taxiServiceDto.City.Trim(),
            PhoneNumber = taxiServiceDto.PhoneNumber.Trim(),
            PricePerKm = taxiServiceDto.PricePerKm,
            Description = taxiServiceDto.Description,
            ImageUrl = taxiServiceDto.ImageUrl
        };

        db.TaxiServices.Add(taxiService);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTaxiService), new { id = taxiService.Id }, taxiService);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateTaxiService(int id, TaxiServiceUpdateDto taxiServiceDto)
    {
        if (string.IsNullOrWhiteSpace(taxiServiceDto.CompanyName) || string.IsNullOrWhiteSpace(taxiServiceDto.City) || string.IsNullOrWhiteSpace(taxiServiceDto.PhoneNumber))
        {
            return BadRequest("CompanyName, City and PhoneNumber are required.");
        }

        var taxiService = await db.TaxiServices.FindAsync(id);

        if (taxiService is null)
        {
            return NotFound();
        }

        var companyName = taxiServiceDto.CompanyName.Trim();

        if (await db.TaxiServices.AnyAsync(taxiService => taxiService.Id != id && taxiService.CompanyName.Trim() == companyName))
        {
            return Conflict("Taxi service with this company name already exists.");
        }

        taxiService.CompanyName = companyName;
        taxiService.City = taxiServiceDto.City.Trim();
        taxiService.PhoneNumber = taxiServiceDto.PhoneNumber.Trim();
        taxiService.PricePerKm = taxiServiceDto.PricePerKm;
        taxiService.Description = taxiServiceDto.Description;
        taxiService.ImageUrl = taxiServiceDto.ImageUrl;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTaxiService(int id)
    {
        var taxiService = await db.TaxiServices.FindAsync(id);

        if (taxiService is null)
        {
            return NotFound();
        }

        db.TaxiServices.Remove(taxiService);
        await db.SaveChangesAsync();

        return NoContent();
    }
}

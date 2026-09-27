using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/taxi-services")]
public class TaxiServicesController(AppDbContext db) : ControllerBase
{
    private static readonly string[] AllowedCarClassNames = ["Standard", "Priority", "Comfort", "Business", "Green", "XL"];

    [HttpGet]
    public async Task<ActionResult<List<TaxiService>>> GetTaxiServices()
    {
        return await db.TaxiServices
            .Include(taxiService => taxiService.CarClasses)
            .AsNoTracking()
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaxiService>> GetTaxiService(int id)
    {
        var taxiService = await db.TaxiServices
            .Include(taxiService => taxiService.CarClasses)
            .AsNoTracking()
            .FirstOrDefaultAsync(taxiService => taxiService.Id == id);

        if (taxiService is null)
        {
            return NotFound();
        }

        return taxiService;
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpPost]
    public async Task<ActionResult<TaxiService>> CreateTaxiService(TaxiServiceCreateDto taxiServiceDto)
    {
        var validationError = ValidateTaxiService(
            taxiServiceDto.CompanyName,
            taxiServiceDto.City,
            taxiServiceDto.PhoneNumber,
            taxiServiceDto.Description,
            taxiServiceDto.ImageUrl,
            taxiServiceDto.CarClasses);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var companyName = taxiServiceDto.CompanyName.Trim();
        var city = NormalizeCities(taxiServiceDto.City)!;

        if (await db.TaxiServices.AnyAsync(taxiService => taxiService.CompanyName.Trim() == companyName))
        {
            return Conflict("Taxi service with this company name already exists.");
        }

        var taxiService = new TaxiService
        {
            CompanyName = companyName,
            City = city,
            PhoneNumber = taxiServiceDto.PhoneNumber.Trim(),
            Description = taxiServiceDto.Description.Trim(),
            ImageUrl = taxiServiceDto.ImageUrl!.Trim(),
            CarClasses = ToCarClasses(taxiServiceDto.CarClasses)
        };

        db.TaxiServices.Add(taxiService);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTaxiService), new { id = taxiService.Id }, taxiService);
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdminOrTaxiOwner)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<TaxiService>> UpdateTaxiService(int id, TaxiServiceUpdateDto taxiServiceDto)
    {
        var validationError = ValidateTaxiService(
            taxiServiceDto.CompanyName,
            taxiServiceDto.City,
            taxiServiceDto.PhoneNumber,
            taxiServiceDto.Description,
            taxiServiceDto.ImageUrl,
            taxiServiceDto.CarClasses);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var taxiService = await db.TaxiServices
            .Include(taxiService => taxiService.CarClasses)
            .FirstOrDefaultAsync(taxiService => taxiService.Id == id);

        if (taxiService is null)
        {
            return NotFound();
        }

        if (!OwnershipRules.CanManageTaxiService(User, taxiService))
        {
            return Forbid();
        }

        var companyName = taxiServiceDto.CompanyName.Trim();
        var city = NormalizeCities(taxiServiceDto.City)!;

        if (await db.TaxiServices.AnyAsync(taxiService => taxiService.Id != id && taxiService.CompanyName.Trim() == companyName))
        {
            return Conflict("Taxi service with this company name already exists.");
        }

        taxiService.CompanyName = companyName;
        taxiService.City = city;
        taxiService.PhoneNumber = taxiServiceDto.PhoneNumber.Trim();
        taxiService.Description = taxiServiceDto.Description.Trim();
        taxiService.ImageUrl = taxiServiceDto.ImageUrl!.Trim();
        taxiService.CarClasses.Clear();

        foreach (var carClass in ToCarClasses(taxiServiceDto.CarClasses))
        {
            taxiService.CarClasses.Add(carClass);
        }

        await db.SaveChangesAsync();

        return taxiService;
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpPut("{id:int}/owner")]
    public async Task<IActionResult> UpdateTaxiServiceOwner(int id, OwnerAssignmentDto request, CancellationToken cancellationToken)
    {
        if (!OwnershipRules.IsAdministrator(User))
        {
            return Forbid();
        }

        var taxiService = await db.TaxiServices.FindAsync([id], cancellationToken);

        if (taxiService is null)
        {
            return NotFound();
        }

        var previousOwnerId = taxiService.OwnerId;
        var (_, error) = await OwnershipRules.ResolveOwnerAsync(db, request.OwnerId, UserRoles.TaxiOwner, cancellationToken);

        if (error is not null)
        {
            return BadRequest(error);
        }

        taxiService.OwnerId = request.OwnerId;
        await db.SaveChangesAsync(cancellationToken);
        await OwnershipRules.ClearUnusedOwnerRoleAsync(db, previousOwnerId == request.OwnerId ? null : previousOwnerId, UserRoles.TaxiOwner, cancellationToken);

        return NoContent();
    }

    [Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTaxiService(int id)
    {
        if (!OwnershipRules.IsAdministrator(User))
        {
            return Forbid();
        }

        var taxiService = await db.TaxiServices.FindAsync(id);

        if (taxiService is null)
        {
            return NotFound();
        }

        await db.Users
            .Where(user => user.TaxiServiceId == id && user.Role == UserRoles.TaxiDriver)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(user => user.Role, UserRoles.User)
                .SetProperty(user => user.TaxiServiceId, (int?)null));

        db.TaxiServices.Remove(taxiService);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static string? ValidateTaxiService(
        string companyName,
        string city,
        string phoneNumber,
        string description,
        string? imageUrl,
        List<TaxiCarClassInputDto>? carClasses)
    {
        if (
            string.IsNullOrWhiteSpace(companyName) ||
            NormalizeCities(city) is null ||
            string.IsNullOrWhiteSpace(phoneNumber) ||
            string.IsNullOrWhiteSpace(description) ||
            string.IsNullOrWhiteSpace(imageUrl))
        {
            return "CompanyName, City, PhoneNumber, Description and ImageUrl are required.";
        }

        if (!IsPhoneNumber(phoneNumber))
        {
            return "PhoneNumber must be a valid phone number.";
        }

        if (!IsAllowedImageUrl(imageUrl))
        {
            return "ImageUrl must be a valid http, https, or uploaded image URL.";
        }

        if (carClasses is null || carClasses.Count == 0)
        {
            return "At least one car class is required.";
        }

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var carClass in carClasses)
        {
            var name = carClass.Name.Trim();

            if (string.IsNullOrWhiteSpace(name))
            {
                return "Car class name is required.";
            }

            if (NormalizeCarClassName(name) is null)
            {
                return "Car class name is not supported.";
            }

            if (carClass.PricePerKm <= 0)
            {
                return "Car class price must be greater than 0.";
            }

            if (!names.Add(name))
            {
                return "Car class names must be unique.";
            }
        }

        return null;
    }

    private static List<TaxiCarClass> ToCarClasses(IEnumerable<TaxiCarClassInputDto> carClasses)
    {
        return carClasses
            .Select(carClass => new TaxiCarClass
            {
                Name = NormalizeCarClassName(carClass.Name.Trim())!,
                PricePerKm = carClass.PricePerKm
            })
            .ToList();
    }

    private static string? NormalizeCarClassName(string name)
    {
        return AllowedCarClassNames.FirstOrDefault(allowedName => allowedName.Equals(name, StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeCities(string city)
    {
        // ponytail: comma-separated cities, add a TaxiServiceCities table when city filtering/searching matters.
        var cities = city
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return cities.Count == 0 || cities.Any(currentCity => !IsCityName(currentCity))
            ? null
            : string.Join(", ", cities);
    }

    private static bool IsCityName(string city)
    {
        return city.Any(char.IsLetter) && city.All(character => char.IsLetter(character) || char.IsWhiteSpace(character) || character == '-' || character == '\'');
    }

    private static bool IsPhoneNumber(string phoneNumber)
    {
        var trimmed = phoneNumber.Trim();
        var digitCount = trimmed.Count(char.IsDigit);
        var plusCount = trimmed.Count(character => character == '+');

        return digitCount is >= 7 and <= 15 &&
            plusCount <= 1 &&
            (plusCount == 0 || trimmed[0] == '+') &&
            trimmed.All(character => char.IsDigit(character) || char.IsWhiteSpace(character) || character is '+' or '-' or '(' or ')');
    }

    private static bool IsAllowedImageUrl(string imageUrl)
    {
        var trimmed = imageUrl.Trim();

        if (trimmed.StartsWith("/images/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}

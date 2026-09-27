using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.AdminOrSuperAdminOrHotelOwner)]
[Route("api/hotel-images")]
public class HotelImagesController(IImageStorageService imageStorage) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(ImageUploadRules.MaxImageBytes)]
    public Task<ActionResult<HotelImageUploadResponse>> Upload([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        return UploadImage(file, "travelhub/hotels", cancellationToken);
    }

    private async Task<ActionResult<HotelImageUploadResponse>> UploadImage(IFormFile file, string folder, CancellationToken cancellationToken)
    {
        var validationError = ImageUploadRules.Validate(file);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        try
        {
            var result = await imageStorage.UploadAsync(file, folder, cancellationToken);
            return Ok(new HotelImageUploadResponse(result.ImageUrl));
        }
        catch (ImageStorageException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Image upload is temporarily unavailable.");
        }
    }
}

public record HotelImageUploadResponse(string ImageUrl);

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
[Route("api/room-images")]
public class RoomImagesController(IImageStorageService imageStorage) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(ImageUploadRules.MaxImageBytes)]
    public async Task<ActionResult<HotelImageUploadResponse>> Upload([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        var validationError = ImageUploadRules.Validate(file);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        try
        {
            var result = await imageStorage.UploadAsync(file, "travelhub/rooms", cancellationToken);
            return Ok(new HotelImageUploadResponse(result.ImageUrl));
        }
        catch (ImageStorageException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Image upload is temporarily unavailable.");
        }
    }
}

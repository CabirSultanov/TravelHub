using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.Models;

namespace TravelHub.Api.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.AdminOrSuperAdmin)]
[Route("api/hotel-images")]
public class HotelImagesController(IWebHostEnvironment environment) : ControllerBase
{
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    [HttpPost]
    [RequestSizeLimit(MaxImageBytes)]
    public async Task<ActionResult<HotelImageUploadResponse>> Upload([FromForm] IFormFile file)
    {
        return await UploadImage(file, "hotel-covers");
    }

    private async Task<ActionResult<HotelImageUploadResponse>> UploadImage(IFormFile file, string folderName)
    {
        if (file.Length == 0)
        {
            return BadRequest("Choose an image file.");
        }

        if (file.Length > MaxImageBytes)
        {
            return BadRequest("Image must be 5 MB or smaller.");
        }

        var extension = Path.GetExtension(file.FileName);

        if (!AllowedExtensions.Contains(extension) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only JPG, PNG, and WEBP images are allowed.");
        }

        var projectRoot = Directory.GetParent(environment.ContentRootPath)?.FullName ?? environment.ContentRootPath;
        var uploadDirectory = Path.Combine(projectRoot, "images", folderName);
        Directory.CreateDirectory(uploadDirectory);

        var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(uploadDirectory, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new HotelImageUploadResponse($"/images/{folderName}/{fileName}"));
    }
}

public record HotelImageUploadResponse(string ImageUrl);

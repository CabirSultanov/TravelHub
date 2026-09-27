using Microsoft.AspNetCore.Http;

namespace TravelHub.Api.Services;

public static class ImageUploadRules
{
    public const long MaxImageBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    public static string? Validate(IFormFile file)
    {
        if (file.Length == 0)
        {
            return "Choose an image file.";
        }

        if (file.Length > MaxImageBytes)
        {
            return "Image must be 5 MB or smaller.";
        }

        var extension = Path.GetExtension(file.FileName);

        return !AllowedExtensions.Contains(extension) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
            ? "Only JPG, PNG, and WEBP images are allowed."
            : null;
    }
}

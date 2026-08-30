using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace TravelHub.Api.Services;

public sealed class CloudinaryImageStorageService(IOptions<CloudinaryOptions> options, ILogger<CloudinaryImageStorageService> logger) : IImageStorageService
{
    public async Task<ImageUploadResult> UploadAsync(IFormFile file, string folder, CancellationToken cancellationToken)
    {
        var settings = options.Value;

        if (string.IsNullOrWhiteSpace(settings.CloudName)
            || string.IsNullOrWhiteSpace(settings.ApiKey)
            || string.IsNullOrWhiteSpace(settings.ApiSecret))
        {
            throw new ImageStorageException("Cloudinary image storage is not configured.");
        }

        try
        {
            var cloudinary = new Cloudinary(new Account(settings.CloudName, settings.ApiKey, settings.ApiSecret));
            await using var stream = file.OpenReadStream();
            var result = await cloudinary.UploadAsync(new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder,
                PublicId = Guid.NewGuid().ToString("N"),
                UseFilename = false,
                UniqueFilename = false
            }, cancellationToken);

            if (result.Error is not null || result.SecureUrl is null)
            {
                throw new ImageStorageException("Cloudinary did not return an image URL.");
            }

            return new ImageUploadResult(result.SecureUrl.ToString());
        }
        catch (ImageStorageException)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Cloudinary image upload failed for folder {Folder}.", folder);
            throw new ImageStorageException("Cloudinary image upload failed.", exception);
        }
    }
}

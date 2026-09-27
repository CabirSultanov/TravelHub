using Microsoft.AspNetCore.Http;

namespace TravelHub.Api.Services;

public sealed record ImageUploadResult(string ImageUrl);

public interface IImageStorageService
{
    Task<ImageUploadResult> UploadAsync(IFormFile file, string folder, CancellationToken cancellationToken);
}

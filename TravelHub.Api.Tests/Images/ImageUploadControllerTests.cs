using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TravelHub.Api.Controllers;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Images;

public class ImageUploadControllerTests
{
    [Theory]
    [InlineData("hotel")]
    [InlineData("room")]
    [InlineData("taxi")]
    public async Task Upload_UsesImageStorageWithExpectedFolder(string imageType)
    {
        var storage = new FakeImageStorageService();
        var file = CreateImageFile();
        ActionResult<HotelImageUploadResponse> result = imageType switch
        {
            "hotel" => await new HotelImagesController(storage).Upload(file, default),
            "room" => await new RoomImagesController(storage).Upload(file, default),
            _ => await new TaxiImagesController(storage).Upload(file, default)
        };

        var response = Assert.IsType<HotelImageUploadResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal($"travelhub/{imageType}s", storage.Folder);
        Assert.Equal("https://res.cloudinary.com/demo/image/upload/travelhub/test.jpg", response.ImageUrl);
    }

    [Theory]
    [InlineData("bad.txt", "text/plain", 1)]
    [InlineData("empty.jpg", "image/jpeg", 0)]
    public async Task HotelUpload_RejectsInvalidFiles(string fileName, string contentType, int size)
    {
        var storage = new FakeImageStorageService();
        var result = await new HotelImagesController(storage).Upload(CreateImageFile(fileName, contentType, size), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.False(storage.WasCalled);
    }

    [Fact]
    public async Task RoomUpload_RejectsOversizedFiles()
    {
        var storage = new FakeImageStorageService();
        var result = await new RoomImagesController(storage).Upload(CreateImageFile(size: (int)ImageUploadRules.MaxImageBytes + 1), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.False(storage.WasCalled);
    }

    [Fact]
    public async Task TaxiUpload_ReturnsServiceUnavailableWhenStorageFails()
    {
        var storage = new FakeImageStorageService { Exception = new ImageStorageException("Unavailable") };
        var result = await new TaxiImagesController(storage).Upload(CreateImageFile(), default);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, response.StatusCode);
    }

    [Theory]
    [InlineData(typeof(HotelImagesController))]
    [InlineData(typeof(RoomImagesController))]
    [InlineData(typeof(TaxiImagesController))]
    public void UploadControllers_RequireAdminOrSuperAdmin(Type controllerType)
    {
        var authorization = Assert.Single(controllerType.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal(UserRoles.AdminOrSuperAdmin, authorization.Roles);
    }

    private static IFormFile CreateImageFile(string fileName = "image.jpg", string contentType = "image/jpeg", int size = 1)
    {
        var stream = new MemoryStream(new byte[size]);
        return new FormFile(stream, 0, stream.Length, "file", fileName)
        {
            Headers = new HeaderDictionary { ["Content-Type"] = contentType }
        };
    }

    private sealed class FakeImageStorageService : IImageStorageService
    {
        public bool WasCalled { get; private set; }
        public string? Folder { get; private set; }
        public Exception? Exception { get; init; }

        public Task<ImageUploadResult> UploadAsync(IFormFile file, string folder, CancellationToken cancellationToken)
        {
            WasCalled = true;
            Folder = folder;
            return Exception is null
                ? Task.FromResult(new ImageUploadResult("https://res.cloudinary.com/demo/image/upload/travelhub/test.jpg"))
                : Task.FromException<ImageUploadResult>(Exception);
        }
    }
}

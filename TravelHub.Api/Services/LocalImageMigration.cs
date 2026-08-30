using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public static class LocalImageMigration
{
    public static async Task<int> RunAsync(IServiceProvider services, string contentRootPath, bool apply, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IImageStorageService>();
        var imagesRoot = Path.GetFullPath(Path.Combine(contentRootPath, "..", "images"));
        var items = new List<LocalImageReference>();

        var hotels = await db.Hotels.ToListAsync(cancellationToken);
        var rooms = await db.HotelRooms.ToListAsync(cancellationToken);
        var taxis = await db.TaxiServices.ToListAsync(cancellationToken);

        foreach (var hotel in hotels)
        {
            AddReference(items, hotel.ImageUrl, "travelhub/hotels");
            foreach (var imageUrl in HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl))
            {
                AddReference(items, imageUrl, "travelhub/hotels");
            }
        }

        foreach (var room in rooms)
        {
            AddReference(items, room.ImageUrl, "travelhub/rooms");
            foreach (var imageUrl in HotelRoomRules.FromJson(room.ImageUrlsJson, room.ImageUrl))
            {
                AddReference(items, imageUrl, "travelhub/rooms");
            }
        }

        foreach (var taxi in taxis)
        {
            AddReference(items, taxi.ImageUrl, "travelhub/taxis");
        }

        var distinctItems = items
            .DistinctBy(item => (item.ImageUrl, item.Folder))
            .ToList();
        var missingFiles = distinctItems.Where(item => !File.Exists(ToLocalPath(imagesRoot, item.ImageUrl))).ToList();

        Console.WriteLine($"Found {distinctItems.Count} local image reference(s): {hotels.Count} hotel(s), {rooms.Count} room(s), {taxis.Count} taxi service(s).");
        foreach (var missing in missingFiles)
        {
            Console.WriteLine($"Missing file: {missing.ImageUrl}");
        }

        if (!apply)
        {
            Console.WriteLine("Dry run complete. No files were uploaded and no database records were changed.");
            return missingFiles.Count == 0 ? 0 : 1;
        }

        if (missingFiles.Count > 0)
        {
            Console.WriteLine("Migration stopped because one or more referenced local files are missing.");
            return 1;
        }

        var replacements = new Dictionary<(string ImageUrl, string Folder), string>();
        foreach (var item in distinctItems)
        {
            var path = ToLocalPath(imagesRoot, item.ImageUrl);
            await using var stream = File.OpenRead(path);
            var formFile = new FormFile(stream, 0, stream.Length, "file", Path.GetFileName(path));
            var uploaded = await storage.UploadAsync(formFile, item.Folder, cancellationToken);
            replacements[(item.ImageUrl, item.Folder)] = uploaded.ImageUrl;
            Console.WriteLine($"Uploaded {item.ImageUrl}.");
        }

        foreach (var hotel in hotels)
        {
            hotel.ImageUrl = Replace(hotel.ImageUrl, "travelhub/hotels", replacements);
            hotel.ImageUrlsJson = HotelRoomRules.ToJson(
                HotelRoomRules.FromJson(hotel.ImageUrlsJson, hotel.ImageUrl)
                    .Select(imageUrl => Replace(imageUrl, "travelhub/hotels", replacements) ?? imageUrl));
        }

        foreach (var room in rooms)
        {
            room.ImageUrl = Replace(room.ImageUrl, "travelhub/rooms", replacements);
            room.ImageUrlsJson = HotelRoomRules.ToJson(
                HotelRoomRules.FromJson(room.ImageUrlsJson, room.ImageUrl)
                    .Select(imageUrl => Replace(imageUrl, "travelhub/rooms", replacements) ?? imageUrl));
        }

        foreach (var taxi in taxis)
        {
            taxi.ImageUrl = Replace(taxi.ImageUrl, "travelhub/taxis", replacements);
        }

        await db.SaveChangesAsync(cancellationToken);
        Console.WriteLine($"Migration complete. Uploaded {distinctItems.Count} image(s) and updated their database links.");
        return 0;
    }

    private static void AddReference(List<LocalImageReference> items, string? imageUrl, string folder)
    {
        if (!string.IsNullOrWhiteSpace(imageUrl) && imageUrl.StartsWith("/images/", StringComparison.OrdinalIgnoreCase))
        {
            items.Add(new LocalImageReference(imageUrl, folder));
        }
    }

    private static string? Replace(string? imageUrl, string folder, IReadOnlyDictionary<(string ImageUrl, string Folder), string> replacements)
        => imageUrl is not null && replacements.TryGetValue((imageUrl, folder), out var replacement) ? replacement : imageUrl;

    private static string ToLocalPath(string imagesRoot, string imageUrl)
    {
        var relativePath = imageUrl["/images/".Length..].Replace('/', Path.DirectorySeparatorChar);
        var path = Path.GetFullPath(Path.Combine(imagesRoot, relativePath));
        if (!path.StartsWith(imagesRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Invalid local image path: {imageUrl}");
        }

        return path;
    }

    private sealed record LocalImageReference(string ImageUrl, string Folder);
}

using System.Text.Json;

namespace TravelHub.Api.Services;

public readonly record struct HotelRoomDraft(string RoomType, int Capacity, int TotalRooms);

public static class HotelRoomRules
{
    public const int MinimumRoomTypes = 2;
    public const int MinimumGuestCapacity = 100;

    public static string? ValidateRoom(string roomType, int capacity, int totalRooms, decimal pricePerNight)
    {
        if (string.IsNullOrWhiteSpace(roomType))
        {
            return "RoomType is required.";
        }

        if (capacity <= 0)
        {
            return "Capacity must be greater than 0.";
        }

        if (totalRooms <= 0)
        {
            return "TotalRooms must be greater than 0.";
        }

        if (pricePerNight < 0)
        {
            return "PricePerNight cannot be negative.";
        }

        return null;
    }

    public static string? ValidateRoomSet(IEnumerable<HotelRoomDraft> rooms)
    {
        var roomList = rooms.ToList();
        var roomTypeCount = roomList
            .Select(room => room.RoomType.Trim())
            .Where(roomType => roomType.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        if (roomTypeCount < MinimumRoomTypes)
        {
            return $"Hotel must have at least {MinimumRoomTypes} room types.";
        }

        var guestCapacity = roomList.Sum(room => room.Capacity * room.TotalRooms);

        if (guestCapacity < MinimumGuestCapacity)
        {
            return $"Hotel rooms must fit at least {MinimumGuestCapacity} guests.";
        }

        return null;
    }

    public static List<string> NormalizeImageUrls(IEnumerable<string>? imageUrls, string? fallbackImageUrl, out string? error)
    {
        error = null;
        var urls = (imageUrls ?? Array.Empty<string>())
            .Append(fallbackImageUrl ?? string.Empty)
            .Select(url => url.Trim())
            .Where(url => url.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (urls.Any(url => !IsAllowedImageUrl(url)))
        {
            error = "Image URLs must be valid http, https, or uploaded image URLs.";
            return new List<string>();
        }

        return urls;
    }

    public static string ToJson(IEnumerable<string> imageUrls) => JsonSerializer.Serialize(imageUrls);

    public static List<string> FromJson(string? imageUrlsJson, string? fallbackImageUrl)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(imageUrlsJson))
            {
                var urls = JsonSerializer.Deserialize<List<string>>(imageUrlsJson);

                if (urls is { Count: > 0 })
                {
                    return NormalizeImageUrls(urls, null, out _);
                }
            }
        }
        catch (JsonException)
        {
        }

        return NormalizeImageUrls(null, fallbackImageUrl, out _);
    }

    private static bool IsAllowedImageUrl(string imageUrl)
    {
        if (imageUrl.StartsWith("/images/rooms/", StringComparison.OrdinalIgnoreCase) ||
            imageUrl.StartsWith("/images/hotel-covers/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}

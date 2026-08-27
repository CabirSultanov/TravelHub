using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class HotelReviewCreateDto
{
    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(1000)]
    public string? Comment { get; set; }
}

public class HotelReviewUpdateDto : HotelReviewCreateDto
{
}

public class HotelReviewResponseDto
{
    public int Id { get; set; }

    public int HotelId { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = string.Empty;

    public int Rating { get; set; }

    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class HotelReviewsResponseDto
{
    public List<HotelReviewResponseDto> Items { get; set; } = [];

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalItems { get; set; }

    public int TotalPages { get; set; }

    public double? AverageRating { get; set; }

    public int ReviewCount { get; set; }

    public int? CurrentUserReviewCount { get; set; }
}

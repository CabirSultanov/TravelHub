using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.Models;

public class HotelReview
{
    public int Id { get; set; }

    public int HotelId { get; set; }

    public Hotel Hotel { get; set; } = null!;

    public int UserId { get; set; }

    public AppUser User { get; set; } = null!;

    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(1000)]
    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.Models;

public class Hotel
{
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    public string ImageUrlsJson { get; set; } = "[]";

    public ICollection<HotelReview> Reviews { get; set; } = new List<HotelReview>();
}

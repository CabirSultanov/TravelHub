using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TravelHub.Api.Models;

public class TaxiService
{
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string CompanyName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    public int? OwnerId { get; set; }

    [JsonIgnore]
    public AppUser? Owner { get; set; }

    public List<TaxiCarClass> CarClasses { get; set; } = new();
}

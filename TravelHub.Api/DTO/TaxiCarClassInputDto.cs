using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class TaxiCarClassInputDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public decimal PricePerKm { get; set; }
}

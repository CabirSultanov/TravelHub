using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TravelHub.Api.Models;

public class TaxiCarClass
{
    public int Id { get; set; }

    public int TaxiServiceId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Precision(18, 2)]
    public decimal PricePerKm { get; set; }
}

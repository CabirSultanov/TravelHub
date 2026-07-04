using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class BookingPaymentDto
{
    [Required]
    [MaxLength(30)]
    public string CardNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string CardHolderName { get; set; } = string.Empty;

    public int ExpiryMonth { get; set; }

    public int ExpiryYear { get; set; }

    [Required]
    [MaxLength(10)]
    public string Cvv { get; set; } = string.Empty;

    public bool SaveCard { get; set; }
}

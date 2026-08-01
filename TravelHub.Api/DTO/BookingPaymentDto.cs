using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class BookingPaymentDto
{
    [MaxLength(30)]
    public string? CardNumber { get; set; }

    [MaxLength(100)]
    public string? CardHolderName { get; set; }

    public int ExpiryMonth { get; set; }

    public int ExpiryYear { get; set; }

    [MaxLength(10)]
    public string? Cvv { get; set; }

    public int? SavedPaymentCardId { get; set; }

    public bool SaveCard { get; set; }
}

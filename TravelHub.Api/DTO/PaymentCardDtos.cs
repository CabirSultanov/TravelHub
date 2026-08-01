using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class PaymentCardCreateDto
{
    [MaxLength(30)]
    public string? CardNumber { get; set; }

    [MaxLength(100)]
    public string? CardHolderName { get; set; }

    public int ExpiryMonth { get; set; }

    public int ExpiryYear { get; set; }

    [MaxLength(10)]
    public string? Cvv { get; set; }
}

public class PaymentCardResponseDto
{
    public int Id { get; set; }

    public string CardHolderName { get; set; } = string.Empty;

    public string Brand { get; set; } = string.Empty;

    public string Last4 { get; set; } = string.Empty;

    public int ExpiryMonth { get; set; }

    public int ExpiryYear { get; set; }
}

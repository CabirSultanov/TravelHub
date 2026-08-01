using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.Models;

public class SavedPaymentCard
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public AppUser User { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string CardHolderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string Brand { get; set; } = string.Empty;

    [Required]
    [MaxLength(4)]
    public string Last4 { get; set; } = string.Empty;

    public int ExpiryMonth { get; set; }

    public int ExpiryYear { get; set; }

    [Required]
    [MaxLength(64)]
    public string Token { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.Models;

public class AppUser
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string Role { get; set; } = UserRoles.User;

    public bool IsBlocked { get; set; }

    public bool EmailConfirmed { get; set; } = true;

    [MaxLength(512)]
    public string? EmailVerificationCodeHash { get; set; }

    public DateTime? EmailVerificationExpiresAt { get; set; }

    public DateTime? EmailVerificationSentAt { get; set; }

    public int EmailVerificationAttemptCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public ICollection<HotelReview> HotelReviews { get; set; } = new List<HotelReview>();

    public ICollection<Hotel> OwnedHotels { get; set; } = new List<Hotel>();

    public ICollection<TaxiService> OwnedTaxiServices { get; set; } = new List<TaxiService>();

    public int? TaxiServiceId { get; set; }

    public TaxiService? TaxiService { get; set; }
}

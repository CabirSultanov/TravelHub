using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.Models;

public class PasswordRecovery
{
    [Key]
    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;

    [MaxLength(512)]
    public string? CodeHash { get; set; }
    [MaxLength(64)]
    public string? ResetTokenHash { get; set; }
    [MaxLength(64)]
    public string CredentialHash { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public int AttemptCount { get; set; }

    // Every write consumes the previous version, including failed code attempts.
    [ConcurrencyCheck]
    public Guid Version { get; set; } = Guid.NewGuid();
}

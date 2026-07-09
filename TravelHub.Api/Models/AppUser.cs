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
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string Role { get; set; } = UserRoles.User;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

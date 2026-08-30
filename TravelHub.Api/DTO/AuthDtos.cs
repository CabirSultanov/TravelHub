using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class RegisterRequestDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Phone]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}

public class LoginRequestDto
{
    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class UpdateProfileRequestDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Phone]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = string.Empty;

    public bool ChangePassword { get; set; }

    public string NewPassword { get; set; } = string.Empty;

    public string ConfirmNewPassword { get; set; } = string.Empty;
}

public class CreateAdminRequestDto : RegisterRequestDto
{
}

public class AuthUserDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public bool IsBlocked { get; set; }
}

public class AuthResponseDto
{
    public AuthUserDto User { get; set; } = new();

    public string AccessToken { get; set; } = string.Empty;

    public DateTime AccessTokenExpiresAt { get; set; }
}

public class EmailConfirmationRequiredDto
{
    public bool EmailConfirmationRequired { get; set; } = true;

    public string Email { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime? ResendAvailableAt { get; set; }
}

public class VerifyEmailRequestDto
{
    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[0-9]{6}$")]
    public string Code { get; set; } = string.Empty;
}

public class ResendEmailConfirmationRequestDto
{
    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;
}

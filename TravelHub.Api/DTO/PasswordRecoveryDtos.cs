using System.ComponentModel.DataAnnotations;

namespace TravelHub.Api.DTO;

public class ForgotPasswordRequestDto
{
    [Required, EmailAddress, MaxLength(150)]
    public string Email { get; set; } = string.Empty;
}

public class VerifyPasswordCodeRequestDto : ForgotPasswordRequestDto
{
    [Required, RegularExpression("^[0-9]{6}$")]
    public string Code { get; set; } = string.Empty;
}

public class ResetPasswordRequestDto : ForgotPasswordRequestDto
{
    [Required, StringLength(64, MinimumLength = 64)]
    public string ResetToken { get; set; } = string.Empty;
    [Required, MinLength(8), MaxLength(128)]
    public string NewPassword { get; set; } = string.Empty;
    [Required, MaxLength(128)]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}

public record PasswordCodeSentDto(string Message, int ResendAfterSeconds = 60);
public record PasswordCodeVerifiedDto(string ResetToken, DateTime ExpiresAt);

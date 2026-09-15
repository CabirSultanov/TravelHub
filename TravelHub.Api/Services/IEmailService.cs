namespace TravelHub.Api.Services;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string email, string name, string code, CancellationToken cancellationToken = default);
    Task SendPasswordRecoveryAsync(string email, string name, string code, CancellationToken cancellationToken = default);
    Task SendPasswordChangedAsync(string email, string name, CancellationToken cancellationToken = default);
}

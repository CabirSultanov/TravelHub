namespace TravelHub.Api.Services;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string email, string name, string code, CancellationToken cancellationToken = default);
}

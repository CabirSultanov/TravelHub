using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace TravelHub.Api.Services;

public sealed class EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger) : IEmailService
{
    public async Task SendEmailConfirmationAsync(string email, string name, string code, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;

        if (string.IsNullOrWhiteSpace(settings.SenderEmail)
            || string.IsNullOrWhiteSpace(settings.Username)
            || string.IsNullOrWhiteSpace(settings.AppPassword))
        {
            throw new InvalidOperationException("Email service is not configured.");
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.SenderName, settings.SenderEmail));
        message.To.Add(new MailboxAddress(name, email));
        message.Subject = "TravelHub email verification";
        message.Body = new BodyBuilder
        {
            TextBody = $"TravelHub email verification\n\nYour verification code is {code}. It expires in 5 minutes.\n\nIf you did not create a TravelHub account, you can ignore this email.",
            HtmlBody = $"""
                <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.5">
                  <h1 style="color:#1f7a8c">TravelHub</h1>
                  <p>Hello {System.Net.WebUtility.HtmlEncode(name)},</p>
                  <p>Use this code to verify your email address:</p>
                  <p style="font-size:32px;font-weight:700;letter-spacing:8px">{code}</p>
                  <p>This code expires in 5 minutes.</p>
                  <p>If you did not create a TravelHub account, you can safely ignore this email.</p>
                </div>
                """
        }.ToMessageBody();

        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(settings.SmtpHost, settings.SmtpPort, SecureSocketOptions.StartTls, cancellationToken);
            await client.AuthenticateAsync(settings.Username, settings.AppPassword, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unable to send TravelHub email confirmation to {Email}.", email);
            throw;
        }
    }
}

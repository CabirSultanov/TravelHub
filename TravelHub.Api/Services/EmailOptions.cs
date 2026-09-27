namespace TravelHub.Api.Services;

public class EmailOptions
{
    public const string SectionName = "Email";

    public string SmtpHost { get; set; } = "smtp.gmail.com";
    public int SmtpPort { get; set; } = 587;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = "TravelHub";
    public string Username { get; set; } = string.Empty;
    public string AppPassword { get; set; } = string.Empty;
}

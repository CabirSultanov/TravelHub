using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TravelHub.Api.Data;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Configuration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTravelHubServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));
        services.AddHostedService<CancelledBookingCleanupService>();
        services.AddOptions<GoogleMapsOptions>()
            .Bind(configuration.GetSection(GoogleMapsOptions.SectionName));
        services.AddOptions<EmailOptions>()
            .Bind(configuration.GetSection(EmailOptions.SectionName));
        services.AddScoped<IEmailService, EmailService>();
        services.AddOptions<CloudinaryOptions>()
            .Bind(configuration.GetSection(CloudinaryOptions.SectionName));
        services.AddScoped<IImageStorageService, CloudinaryImageStorageService>();
        services.AddHttpClient<IRoutingService, GoogleRoutesService>(client =>
        {
            client.BaseAddress = new Uri("https://routes.googleapis.com/");
            client.Timeout = TimeSpan.FromSeconds(12);
        });
        services.AddScoped<PasswordHasher<AppUser>>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddDataProtection();
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(options => !string.IsNullOrWhiteSpace(options.Issuer), "Jwt:Issuer is required.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.Audience), "Jwt:Audience is required.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.Key) && options.Key.Length >= 32, "Jwt:Key must be at least 32 characters.")
            .Validate(options => options.AccessTokenMinutes > 0, "Jwt:AccessTokenMinutes must be greater than 0.")
            .Validate(options => options.RefreshTokenDays > 0, "Jwt:RefreshTokenDays must be greater than 0.")
            .ValidateOnStart();

        services.AddControllers();
        services.AddCors(options =>
        {
            options.AddPolicy("LocalClient", policy =>
                policy
                    .WithOrigins("http://localhost:5173", "https://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials());
        });
        var jwtOptions = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException("JWT configuration is not configured.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
                    NameClaimType = System.Security.Claims.ClaimTypes.Name,
                    RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                    ClockSkew = TimeSpan.Zero
                };
            });
        services.AddAuthorization();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        return services;
    }
}

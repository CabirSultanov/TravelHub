using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;

namespace TravelHub.Api.Configuration;

public static class WebApplicationExtensions
{
    public static WebApplication UseTravelHubPipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            app.UseCors("LocalClient");
        }

        app.UseAuthentication();
        app.Use(async (context, next) =>
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var value = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (int.TryParse(value, out var userId))
                {
                    var db = context.RequestServices.GetRequiredService<AppDbContext>();
                    var isBlocked = await db.Users.AsNoTracking().AnyAsync(user => user.Id == userId && user.IsBlocked);

                    if (isBlocked)
                    {
                        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        return;
                    }
                }
            }

            await next();
        });
        app.UseAuthorization();

        return app;
    }

    public static WebApplication MapTravelHubEndpoints(this WebApplication app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .WithName("GetHealth")
            .WithOpenApi();

        app.MapGet("/health/db", async (AppDbContext db) =>
        {
            if (!await db.Database.CanConnectAsync())
            {
                return Results.Problem("Database is not connected.");
            }

            return Results.Ok(new { status = "ok", database = "connected" });
        })
            .WithName("GetDatabaseHealth")
            .WithOpenApi();

        app.MapControllers();

        return app;
    }
}

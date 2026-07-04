using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));
builder.Services.AddHostedService<CancelledBookingCleanupService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await BaselineExistingPlacesMigrationAsync(db);
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("GetHealth")
    .WithOpenApi();

app.MapGet("/health/db", async () =>
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync();

    await using var command = new SqlCommand("SELECT 1", connection);
    var result = await command.ExecuteScalarAsync();

    return Results.Ok(new { status = "ok", database = "connected", result });
})
    .WithName("GetDatabaseHealth")
    .WithOpenApi();

app.MapControllers();

app.Run();

static async Task BaselineExistingPlacesMigrationAsync(AppDbContext db)
{
    await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;

IF OBJECT_ID(N'[dbo].[Places]', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260703143000_InitialCreate'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260703143000_InitialCreate', N'8.0.3');
END;
""");
}

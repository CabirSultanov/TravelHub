using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));
builder.Services.AddHostedService<CancelledBookingCleanupService>();
builder.Services.AddScoped<PasswordHasher<AppUser>>();

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalClient", policy =>
        policy
            .WithOrigins("http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "TravelHub.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await BaselineExistingPlacesMigrationAsync(db);
        await EnsureUserBlockingColumnAsync(db);
        await db.Database.MigrateAsync();
        await EnsureUserBlockingColumnAsync(db);
        await SeedDemoDataAsync(db);
        var passwordHasher = scope.ServiceProvider.GetRequiredService<PasswordHasher<AppUser>>();
        await SeedSuperAdminAsync(db, passwordHasher, app.Configuration);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Database startup failed.");
        Environment.ExitCode = 1;
        return;
    }
}

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

static async Task EnsureUserBlockingColumnAsync(AppDbContext db)
{
    await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[Users]', N'IsBlocked') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [IsBlocked] bit NOT NULL
        CONSTRAINT [DF_Users_IsBlocked] DEFAULT CAST(0 AS bit);
END;

IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[Users]', N'IsBlocked') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260710151000_AddUserBlocking'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260710151000_AddUserBlocking', N'8.0.3');
END;
""");
}

static async Task SeedDemoDataAsync(AppDbContext db)
{
    var bakuHotel = await AddHotelAsync(
        "Baku Grand Hotel",
        "Baku",
        "Neftchilar Avenue 12",
        180,
        "Central hotel near Baku Boulevard.",
        "https://placehold.co/600x400?text=Baku+Grand+Hotel");

    var shahdagHotel = await AddHotelAsync(
        "Shahdag Mountain Resort",
        "Shahdag",
        "Shahdag Tourism Complex",
        220,
        "Mountain resort close to ski lifts.",
        "https://placehold.co/600x400?text=Shahdag+Resort");

    await AddRoomAsync(bakuHotel.Id, "Standard Double", 2, 8, 120, "Comfortable room for two guests.", "https://placehold.co/600x400?text=Standard+Double");
    await AddRoomAsync(bakuHotel.Id, "Family Suite", 4, 4, 210, "Two-room suite for families.", "https://placehold.co/600x400?text=Family+Suite");
    await AddRoomAsync(shahdagHotel.Id, "Mountain View Double", 2, 6, 160, "Room with mountain view.", "https://placehold.co/600x400?text=Mountain+View");
    await AddRoomAsync(shahdagHotel.Id, "Chalet Suite", 5, 3, 280, "Large suite for groups and families.", "https://placehold.co/600x400?text=Chalet+Suite");

    await db.SaveChangesAsync();

    async Task<Hotel> AddHotelAsync(string name, string city, string address, decimal price, string description, string imageUrl)
    {
        var hotel = await db.Hotels.FirstOrDefaultAsync(hotel => hotel.Name == name);

        if (hotel is not null)
        {
            return hotel;
        }

        hotel = new Hotel
        {
            Name = name,
            City = city,
            Address = address,
            PricePerNight = price,
            Description = description,
            ImageUrl = imageUrl
        };

        db.Hotels.Add(hotel);
        await db.SaveChangesAsync();
        return hotel;
    }

    async Task AddRoomAsync(int hotelId, string roomType, int capacity, int totalRooms, decimal price, string description, string imageUrl)
    {
        if (await db.HotelRooms.AnyAsync(room => room.HotelId == hotelId && room.RoomType == roomType))
        {
            return;
        }

        db.HotelRooms.Add(new HotelRoom
        {
            HotelId = hotelId,
            RoomType = roomType,
            Capacity = capacity,
            TotalRooms = totalRooms,
            PricePerNight = price,
            Description = description,
            ImageUrl = imageUrl,
            IsAvailable = true
        });
    }

}

static async Task SeedSuperAdminAsync(AppDbContext db, PasswordHasher<AppUser> passwordHasher, IConfiguration configuration)
{
    if (await db.Users.AnyAsync(user => user.Role == UserRoles.SuperAdmin))
    {
        return;
    }

    var section = configuration.GetSection("SeedSuperAdmin");
    var email = section["Email"]?.Trim().ToLowerInvariant();
    var password = section["Password"];

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        return;
    }

    var user = await db.Users.FirstOrDefaultAsync(user => user.Email == email);

    if (user is null)
    {
        user = new AppUser
        {
            Name = string.IsNullOrWhiteSpace(section["Name"]) ? "Super Admin" : section["Name"]!.Trim(),
            Email = email,
            Role = UserRoles.SuperAdmin
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);
        db.Users.Add(user);
    }
    else
    {
        user.Role = UserRoles.SuperAdmin;
    }

    await db.SaveChangesAsync();
}

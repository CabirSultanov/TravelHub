using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Models;

namespace TravelHub.Api.Data;

public static class DatabaseStartup
{
    public static async Task<bool> InitializeDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();

        try
        {
            await RunDatabaseStartupAsync(scope.ServiceProvider, app);
            return true;
        }
        catch (Exception ex)
        {
            app.Logger.LogCritical(ex, "Database startup failed.");
            Environment.ExitCode = 1;
            return false;
        }
    }

    private static async Task RunDatabaseStartupAsync(IServiceProvider services, WebApplication app)
    {
        const int maxAttempts = 3;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var db = services.GetRequiredService<AppDbContext>();
                await BaselineExistingPlacesMigrationAsync(db);
                await EnsureUserBlockingColumnAsync(db);
                await EnsureUserPhoneNumberColumnAsync(db);
                await EnsureHotelRoomImageUrlsColumnAsync(db);
                await EnsureSavedPaymentCardsTableAsync(db);
                await EnsureTaxiBookingsTableAsync(db);
                await db.Database.MigrateAsync();
                await EnsureUserBlockingColumnAsync(db);
                await EnsureUserPhoneNumberColumnAsync(db);
                await EnsureHotelRoomImageUrlsColumnAsync(db);
                await EnsureSavedPaymentCardsTableAsync(db);
                await EnsureTaxiBookingsTableAsync(db);
                var passwordHasher = services.GetRequiredService<PasswordHasher<AppUser>>();
                await SeedSuperAdminAsync(db, passwordHasher, app.Configuration);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                app.Logger.LogWarning(ex, "Database startup attempt {Attempt}/{MaxAttempts} failed. Retrying...", attempt, maxAttempts);
                await Task.Delay(TimeSpan.FromSeconds(3));
            }
        }

        throw new InvalidOperationException("Database startup failed.");
    }

    private static async Task BaselineExistingPlacesMigrationAsync(AppDbContext db)
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

    private static async Task EnsureUserBlockingColumnAsync(AppDbContext db)
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

    private static async Task EnsureUserPhoneNumberColumnAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[Users]', N'PhoneNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [PhoneNumber] nvarchar(50) NOT NULL
        CONSTRAINT [DF_Users_PhoneNumber] DEFAULT N'';
END;

IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[Users]', N'PhoneNumber') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260727120000_AddUserPhoneNumber'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260727120000_AddUserPhoneNumber', N'8.0.3');
END;
""");
    }

    private static async Task EnsureHotelRoomImageUrlsColumnAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[HotelRooms]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[HotelRooms]', N'ImageUrlsJson') IS NULL
BEGIN
    ALTER TABLE [dbo].[HotelRooms]
    ADD [ImageUrlsJson] nvarchar(max) NOT NULL
        CONSTRAINT [DF_HotelRooms_ImageUrlsJson] DEFAULT N'[]';
END;

IF OBJECT_ID(N'[dbo].[HotelRooms]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[HotelRooms]', N'ImageUrlsJson') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260730120000_AddHotelRoomImageUrlsJson'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730120000_AddHotelRoomImageUrlsJson', N'8.0.3');
END;
""");
    }

    private static async Task EnsureSavedPaymentCardsTableAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND OBJECT_ID(N'[dbo].[SavedPaymentCards]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavedPaymentCards] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [CardHolderName] nvarchar(100) NOT NULL,
        [Brand] nvarchar(20) NOT NULL,
        [Last4] nvarchar(4) NOT NULL,
        [ExpiryMonth] int NOT NULL,
        [ExpiryYear] int NOT NULL,
        [Token] nvarchar(64) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_SavedPaymentCards] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SavedPaymentCards_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_SavedPaymentCards_UserId] ON [dbo].[SavedPaymentCards] ([UserId]);
END;

IF OBJECT_ID(N'[dbo].[SavedPaymentCards]', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260801120000_AddSavedPaymentCards'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260801120000_AddSavedPaymentCards', N'8.0.3');
END;
""");
    }

    private static async Task EnsureTaxiBookingsTableAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    AND OBJECT_ID(N'[dbo].[TaxiBookings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TaxiBookings] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [TaxiServiceId] int NOT NULL,
        [TaxiServiceName] nvarchar(150) NOT NULL,
        [CarClassName] nvarchar(100) NOT NULL,
        [CustomerName] nvarchar(100) NOT NULL,
        [PhoneNumber] nvarchar(50) NOT NULL,
        [Email] nvarchar(150) NOT NULL,
        [PickupAddress] nvarchar(200) NOT NULL,
        [DropoffAddress] nvarchar(200) NOT NULL,
        [PickupX] decimal(18,2) NOT NULL,
        [PickupY] decimal(18,2) NOT NULL,
        [DropoffX] decimal(18,2) NOT NULL,
        [DropoffY] decimal(18,2) NOT NULL,
        [PickupLatitude] decimal(9,6) NOT NULL,
        [PickupLongitude] decimal(9,6) NOT NULL,
        [DropoffLatitude] decimal(9,6) NOT NULL,
        [DropoffLongitude] decimal(9,6) NOT NULL,
        [DistanceKm] decimal(18,2) NOT NULL,
        [PricePerKm] decimal(18,2) NOT NULL,
        [TotalPrice] decimal(18,2) NOT NULL,
        [Status] int NOT NULL,
        [PaidAt] datetime2 NULL,
        [CancelledAt] datetime2 NULL,
        [SavedCardLast4] nvarchar(4) NULL,
        CONSTRAINT [PK_TaxiBookings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TaxiBookings_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_TaxiBookings_UserId] ON [dbo].[TaxiBookings] ([UserId]);
END;

IF OBJECT_ID(N'[dbo].[TaxiBookings]', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N'20260804190000_AddTaxiBookings'
    )
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260804190000_AddTaxiBookings', N'8.0.3');
END;
""");
    }

    private static async Task SeedSuperAdminAsync(AppDbContext db, PasswordHasher<AppUser> passwordHasher, IConfiguration configuration)
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
                PhoneNumber = section["PhoneNumber"]?.Trim() ?? string.Empty,
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
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TravelHub.Api.Models;

namespace TravelHub.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<HotelRoom> HotelRooms => Set<HotelRoom>();
    public DbSet<BookingRequest> BookingRequests => Set<BookingRequest>();
    public DbSet<TaxiBooking> TaxiBookings => Set<TaxiBooking>();
    public DbSet<TaxiBookingDriverDecline> TaxiBookingDriverDeclines => Set<TaxiBookingDriverDecline>();
    public DbSet<SavedPaymentCard> SavedPaymentCards => Set<SavedPaymentCard>();
    public DbSet<TaxiService> TaxiServices => Set<TaxiService>();
    public DbSet<TaxiCarClass> TaxiCarClasses => Set<TaxiCarClass>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<HotelReview> HotelReviews => Set<HotelReview>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var utcDateTimeConverter = new ValueConverter<DateTime, DateTime>(
            value => value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc),
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        var nullableUtcDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            value => value.HasValue
                ? value.Value.Kind == DateTimeKind.Local ? value.Value.ToUniversalTime() : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : null,
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null);

        modelBuilder.Entity<AppUser>()
            .HasIndex(user => user.Email)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .Property(user => user.EmailConfirmed)
            .HasDefaultValue(true)
            .ValueGeneratedNever();

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(refreshToken => refreshToken.TokenHash)
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasOne(refreshToken => refreshToken.User)
            .WithMany(user => user.RefreshTokens)
            .HasForeignKey(refreshToken => refreshToken.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaxiService>()
            .HasMany(taxiService => taxiService.CarClasses)
            .WithOne()
            .HasForeignKey(carClass => carClass.TaxiServiceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SavedPaymentCard>()
            .HasOne(card => card.User)
            .WithMany()
            .HasForeignKey(card => card.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Hotel>()
            .HasOne(hotel => hotel.Owner)
            .WithMany(user => user.OwnedHotels)
            .HasForeignKey(hotel => hotel.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TaxiService>()
            .HasOne(taxiService => taxiService.Owner)
            .WithMany(user => user.OwnedTaxiServices)
            .HasForeignKey(taxiService => taxiService.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AppUser>()
            .HasOne(user => user.TaxiService)
            .WithMany(taxiService => taxiService.Drivers)
            .HasForeignKey(user => user.TaxiServiceId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TaxiBooking>()
            .HasOne(booking => booking.Driver)
            .WithMany()
            .HasForeignKey(booking => booking.DriverId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TaxiBooking>()
            .Property(booking => booking.RowVersion)
            .IsRowVersion();

        modelBuilder.Entity<TaxiBookingDriverDecline>()
            .HasKey(decline => new { decline.TaxiBookingId, decline.DriverId });

        modelBuilder.Entity<TaxiBookingDriverDecline>()
            .HasOne(decline => decline.TaxiBooking)
            .WithMany(booking => booking.DriverDeclines)
            .HasForeignKey(decline => decline.TaxiBookingId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaxiBookingDriverDecline>()
            .HasOne(decline => decline.Driver)
            .WithMany()
            .HasForeignKey(decline => decline.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HotelReview>()
            .HasIndex(review => new { review.UserId, review.HotelId })
            .IsUnique();

        modelBuilder.Entity<HotelReview>()
            .Property(review => review.CreatedAt)
            .HasConversion(utcDateTimeConverter);

        modelBuilder.Entity<HotelReview>()
            .Property(review => review.UpdatedAt)
            .HasConversion(nullableUtcDateTimeConverter);

        modelBuilder.Entity<HotelReview>()
            .HasOne(review => review.Hotel)
            .WithMany(hotel => hotel.Reviews)
            .HasForeignKey(review => review.HotelId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<HotelReview>()
            .HasOne(review => review.User)
            .WithMany(user => user.HotelReviews)
            .HasForeignKey(review => review.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

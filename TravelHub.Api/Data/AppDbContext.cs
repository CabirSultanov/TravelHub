using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Models;

namespace TravelHub.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<HotelRoom> HotelRooms => Set<HotelRoom>();
    public DbSet<BookingRequest> BookingRequests => Set<BookingRequest>();
    public DbSet<TaxiBooking> TaxiBookings => Set<TaxiBooking>();
    public DbSet<SavedPaymentCard> SavedPaymentCards => Set<SavedPaymentCard>();
    public DbSet<TaxiService> TaxiServices => Set<TaxiService>();
    public DbSet<TaxiCarClass> TaxiCarClasses => Set<TaxiCarClass>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>()
            .HasIndex(user => user.Email)
            .IsUnique();

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
    }
}

using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Models;

namespace TravelHub.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Place> Places => Set<Place>();
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<HotelRoom> HotelRooms => Set<HotelRoom>();
    public DbSet<BookingRequest> BookingRequests => Set<BookingRequest>();
    public DbSet<TaxiService> TaxiServices => Set<TaxiService>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>()
            .HasIndex(user => user.Email)
            .IsUnique();
    }
}

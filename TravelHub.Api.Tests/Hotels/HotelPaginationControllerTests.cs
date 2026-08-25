using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Hotels;

public class HotelPaginationControllerTests
{
    [Fact]
    public async Task GetHotels_ReturnsFirstPageWithTotals()
    {
        await using var db = CreateDb();
        SeedHotels(db, 7, "Baku");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 1, pageSize: 3);
        var response = result.Value!;

        Assert.Equal(3, response.Items.Count);
        Assert.Equal(7, response.TotalItems);
        Assert.Equal(3, response.TotalPages);
        Assert.Equal(1, response.Page);
    }

    [Fact]
    public async Task GetHotels_ReturnsSecondPageInStableOrder()
    {
        await using var db = CreateDb();
        SeedHotels(db, 7, "Baku");
        await db.SaveChangesAsync();
        var expectedIds = await db.Hotels.OrderBy(hotel => hotel.Id).Skip(3).Take(3).Select(hotel => hotel.Id).ToListAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 2, pageSize: 3);
        var response = result.Value!;

        Assert.Equal(expectedIds, response.Items.Select(hotel => hotel.Id));
        Assert.Equal(2, response.Page);
    }

    [Fact]
    public async Task GetHotels_ReturnsLastPageRemainder()
    {
        await using var db = CreateDb();
        SeedHotels(db, 7, "Baku");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 3, pageSize: 3);
        var response = result.Value!;

        Assert.Single(response.Items);
        Assert.Equal(3, response.Page);
    }

    [Fact]
    public async Task GetHotels_NormalizesInvalidPage()
    {
        await using var db = CreateDb();
        SeedHotels(db, 2, "Baku");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 0, pageSize: 3);
        var response = result.Value!;

        Assert.Equal(1, response.Page);
        Assert.Equal(2, response.Items.Count);
    }

    [Fact]
    public async Task GetHotels_WhenRequestedPageIsTooLarge_UsesLastPage()
    {
        await using var db = CreateDb();
        SeedHotels(db, 7, "Baku");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 9, pageSize: 3);
        var response = result.Value!;

        Assert.Equal(3, response.Page);
        Assert.Single(response.Items);
    }

    [Fact]
    public async Task GetHotels_WithZeroHotels_ReturnsEmptyFirstPage()
    {
        await using var db = CreateDb();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 2, pageSize: 3);
        var response = result.Value!;

        Assert.Empty(response.Items);
        Assert.Equal(1, response.Page);
        Assert.Equal(0, response.TotalItems);
        Assert.Equal(0, response.TotalPages);
    }

    [Fact]
    public async Task GetHotels_FiltersByCityBeforePagination()
    {
        await using var db = CreateDb();
        SeedHotels(db, 5, "Baku");
        SeedHotels(db, 4, "Gabala");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotels(page: 1, pageSize: 3, city: "Baku");
        var response = result.Value!;

        Assert.Equal(3, response.Items.Count);
        Assert.Equal(5, response.TotalItems);
        Assert.Equal(2, response.TotalPages);
        Assert.All(response.Items, hotel => Assert.Equal("Baku", hotel.City));
    }

    [Fact]
    public async Task GetHotelCities_ReturnsDistinctSortedCities()
    {
        await using var db = CreateDb();
        SeedHotels(db, 1, "Gabala");
        SeedHotels(db, 1, "Baku");
        SeedHotels(db, 1, "Baku");
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var result = await controller.GetHotelCities();

        Assert.Equal(["Baku", "Gabala"], result.Value);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static void SeedHotels(AppDbContext db, int count, string city)
    {
        for (var index = 1; index <= count; index++)
        {
            db.Hotels.Add(new Hotel
            {
                Name = $"{city} Hotel {index}",
                City = city,
                Description = "",
                ImageUrlsJson = "[]"
            });
        }
    }
}

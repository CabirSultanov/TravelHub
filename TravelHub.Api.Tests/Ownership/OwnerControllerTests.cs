using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TravelHub.Api.Configuration;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Ownership;

public class OwnerControllerTests
{
    private static readonly DateOnly Today = new(2026, 9, 16);

    [Fact]
    public async Task Hotels_ScopesBeforeSearchAndPagination_AndReturnsExistingHotelStats()
    {
        await using var db = await CreateDb();
        var controller = Controller(db);

        var first = (await controller.GetHotels(pageSize: 1)).Value!;
        Assert.Equal(2, first.TotalItems);
        Assert.Equal(2, first.TotalPages);
        var hotel = Assert.Single(first.Items);
        Assert.Equal(1, hotel.Id);
        Assert.Equal(2, hotel.RoomTypesCount);
        Assert.Equal(60, hotel.TotalRoomsCount);
        Assert.Equal(140, hotel.TotalGuestPlaces);
        Assert.Equal("https://example.com/hotel.jpg", hotel.ImageUrl);

        var last = (await controller.GetHotels(page: int.MaxValue, pageSize: 1)).Value!;
        Assert.Equal(2, last.Page);
        Assert.Equal(3, Assert.Single(last.Items).Id);
        var searched = (await controller.GetHotels(" BAKU ", page: -1, pageSize: int.MaxValue)).Value!;
        Assert.Equal(1, searched.Page);
        Assert.Equal(100, searched.PageSize);
        Assert.Equal(1, Assert.Single(searched.Items).Id);
        Assert.Empty((await controller.GetHotels("Hidden")).Value!.Items);
    }

    [Theory]
    [InlineData(UserRoles.User)]
    [InlineData(UserRoles.Admin)]
    [InlineData(UserRoles.SuperAdmin)]
    [InlineData(UserRoles.TaxiOwner)]
    [InlineData(UserRoles.TaxiDriver)]
    public async Task OwnerEndpoints_RejectOtherRoles(string role)
    {
        await using var db = await CreateDb();
        var controller = Controller(db, role: role);
        await AssertForbidden(controller);
    }

    [Theory]
    [InlineData("demoted")]
    [InlineData("blocked")]
    [InlineData("missing")]
    public async Task OwnerEndpoints_RecheckDatabaseAccessDespiteOwnerToken(string change)
    {
        await using var db = await CreateDb();
        var user = (await db.Users.FindAsync(1))!;
        if (change == "demoted") user.Role = UserRoles.User;
        if (change == "blocked") user.IsBlocked = true;
        if (change == "missing") db.Users.Remove(user);
        await db.SaveChangesAsync();
        await AssertForbidden(Controller(db));
    }

    [Fact]
    public async Task EmptyOwnership_ReturnsEmptyPagesAndZeroOverview()
    {
        await using var db = await CreateDb();
        var controller = Controller(db, userId: 4);
        var hotels = (await controller.GetHotels(page: 200, pageSize: 0)).Value!;
        Assert.Empty(hotels.Items);
        Assert.Equal(1, hotels.Page);
        Assert.Equal(1, hotels.PageSize);
        Assert.Equal(0, hotels.TotalPages);
        Assert.Empty((await controller.GetBookings()).Value!.Items);
        var overview = (await controller.GetOverview()).Value!;
        Assert.Equal(0, overview.ArrivalsToday + overview.DeparturesToday + overview.AwaitingPayment);
        Assert.Empty(overview.UpcomingArrivals);
    }

    [Fact]
    public async Task UnownedOrMissingHotelFiltersAndBookingIds_ReturnNotFound()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(Booking(1), Booking(2, hotelId: 2));
        await db.SaveChangesAsync();
        var controller = Controller(db);
        foreach (var id in new[] { 2, 999 })
        {
            Assert.IsType<NotFoundResult>((await controller.GetOverview(id)).Result);
            Assert.IsType<NotFoundResult>((await controller.GetBookings(hotelId: id)).Result);
            Assert.IsType<NotFoundResult>((await controller.GetBooking(id)).Result);
        }

        (await db.Hotels.FindAsync(1))!.OwnerId = 2;
        await db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>((await controller.GetBooking(1)).Result);
    }

    [Fact]
    public async Task Overview_UsesBakuDatePaidCountersAndFiveNearestArrivals()
    {
        await using var db = await CreateDb();
        db.BookingRequests.AddRange(
            Booking(1), Booking(2, -1, 0),
            Booking(3, status: BookingStatus.PendingPayment),
            Booking(4, -2, 0, BookingStatus.PendingPayment),
            Booking(5, status: BookingStatus.Cancelled),
            Booking(6, hotelId: 2),
            Booking(7, -1, 1), Booking(8, 2, 3, hotelId: 3),
            Booking(9, 1, 2), Booking(10, 1, 2), Booking(11, 3, 4), Booking(12, 4, 5));
        await db.SaveChangesAsync();

        var overview = (await Controller(db).GetOverview()).Value!;
        Assert.Equal(Today, overview.Today);
        Assert.Equal(1, overview.ArrivalsToday);
        Assert.Equal(1, overview.DeparturesToday);
        Assert.Equal(1, overview.AwaitingPayment);
        Assert.Equal(new[] { 1, 9, 10, 8, 11 }, overview.UpcomingArrivals.Select(booking => booking.Id));
        var filtered = (await Controller(db).GetOverview(3)).Value!;
        Assert.Equal(0, filtered.ArrivalsToday + filtered.DeparturesToday + filtered.AwaitingPayment);
        Assert.Equal(8, Assert.Single(filtered.UpcomingArrivals).Id);
        Assert.Contains("\"today\":\"2026-09-16\"", JsonSerializer.Serialize(overview, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Theory]
    [InlineData("upcoming", "1,2,5")]
    [InlineData("past", "4,3")]
    [InlineData("arrivals", "2")]
    [InlineData("departures", "3")]
    [InlineData("all", "4,1,3,2,5")]
    public async Task Bookings_FiltersPeriodsAcrossOwnedHotels(string period, string ids)
    {
        await using var db = await CreateDb();
        await SeedPeriodBookings(db);
        var result = (await Controller(db).GetBookings(period: period)).Value!;
        Assert.Equal(ids, string.Join(",", result.Items.Select(booking => booking.Id)));
        Assert.Equal(result.Items.Count, result.TotalItems);
    }

    [Fact]
    public async Task Bookings_FiltersStatusHotelSearchBeforePagination()
    {
        await using var db = await CreateDb();
        await SeedPeriodBookings(db);
        var controller = Controller(db);
        var page = (await controller.GetBookings(status: "Paid", period: "all", page: 2, pageSize: 1)).Value!;
        Assert.Equal(3, page.TotalItems);
        Assert.Equal(2, Assert.Single(page.Items).Id);
        Assert.Equal(5, Assert.Single((await controller.GetBookings(hotelId: 3)).Value!.Items).Id);
        Assert.Equal(3, Assert.Single((await controller.GetBookings(search: " Guest 3 ", period: "all")).Value!.Items).Id);
        Assert.Equal(3, Assert.Single((await controller.GetBookings(search: "3", period: "all")).Value!.Items).Id);
        Assert.Empty((await controller.GetBookings(search: "Hidden", period: "all")).Value!.Items);
        Assert.Equal(4, Assert.Single((await controller.GetBookings(status: "Cancelled", period: "all")).Value!.Items).Id);
    }

    [Theory]
    [InlineData("paid")]
    [InlineData("0")]
    [InlineData("")]
    [InlineData("Unknown")]
    public async Task Bookings_RejectsUnknownOrNumericStatuses(string status)
    {
        await using var db = await CreateDb();
        Assert.IsType<BadRequestObjectResult>((await Controller(db).GetBookings(status: status)).Result);
    }

    [Fact]
    public async Task Bookings_DateRangeMatchesStaysOverlappingInclusiveDays_AndCombinesFilters()
    {
        await using var db = await CreateDb();
        await SeedPeriodBookings(db);
        var controller = Controller(db);
        var today = (await controller.GetBookings(period: "all", from: Today, to: Today)).Value!;
        Assert.Equal(new[] { 1, 2 }, today.Items.Select(booking => booking.Id));
        var throughToday = (await controller.GetBookings(period: "all", to: Today)).Value!;
        Assert.Equal(new[] { 4, 1, 3, 2 }, throughToday.Items.Select(booking => booking.Id));
        var later = (await controller.GetBookings(period: "all", from: Today.AddDays(1))).Value!;
        Assert.Equal(5, Assert.Single(later.Items).Id);
        var paid = (await controller.GetBookings(status: "Paid", from: Today, to: Today)).Value!;
        Assert.Equal(2, Assert.Single(paid.Items).Id);
        Assert.IsType<BadRequestObjectResult>((await controller.GetBookings(from: Today, to: Today.AddDays(-1))).Result);
    }

    [Fact]
    public async Task Bookings_RejectsUnknownPeriod_AndNeverExposesUserOrPaymentFields()
    {
        await using var db = await CreateDb();
        db.BookingRequests.Add(Booking(1));
        await db.SaveChangesAsync();
        var controller = Controller(db);
        Assert.IsType<BadRequestObjectResult>((await controller.GetBookings(period: "invalid")).Result);
        var detail = (await controller.GetBooking(1)).Value!;
        Assert.Equal(175m, detail.TotalPrice);
        var fields = JsonDocument.Parse(JsonSerializer.Serialize(detail, new JsonSerializerOptions(JsonSerializerDefaults.Web)))
            .RootElement.EnumerateObject().Select(property => property.Name).Order().ToArray();
        Assert.Equal(new[] { "id", "hotelId", "hotelRoomId", "hotelName", "roomType", "customerName", "phoneNumber", "email",
            "checkInDate", "checkOutDate", "status", "paidAt", "cancelledAt", "totalPrice" }.Order(), fields);
    }

    [Fact]
    public void Services_DoNotRegisterCancelledBookingCleanup()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Server=unused;Database=unused;",
            ["Jwt:Issuer"] = "tests", ["Jwt:Audience"] = "tests", ["Jwt:Key"] = new string('x', 32)
        }).Build();
        var services = new ServiceCollection().AddTravelHubServices(configuration);
        Assert.DoesNotContain(services, descriptor => descriptor.ServiceType == typeof(IHostedService)
            && descriptor.ImplementationType?.Name.Contains("CancelledBookingCleanup") == true);
    }

    private static async Task AssertForbidden(OwnerController controller)
    {
        Assert.IsType<ForbidResult>((await controller.GetHotels()).Result);
        Assert.IsType<ForbidResult>((await controller.GetOverview()).Result);
        Assert.IsType<ForbidResult>((await controller.GetBookings()).Result);
        Assert.IsType<ForbidResult>((await controller.GetBooking(1)).Result);
    }

    private static async Task SeedPeriodBookings(AppDbContext db)
    {
        db.BookingRequests.AddRange(Booking(1, -2, 1, BookingStatus.PendingPayment), Booking(2), Booking(3, -2, 0),
            Booking(4, -3, -1, BookingStatus.Cancelled), Booking(5, 2, 3, hotelId: 3), Booking(6, hotelId: 2));
        await db.SaveChangesAsync();
    }

    private static BookingRequest Booking(int id, int checkIn = 0, int checkOut = 1, BookingStatus status = BookingStatus.Paid, int hotelId = 1) => new()
    {
        Id = id, UserId = 9, HotelRoomId = hotelId * 10, CustomerName = $"Guest {id}", PhoneNumber = "555000", Email = "guest@example.com",
        CheckInDate = Today.AddDays(checkIn), CheckOutDate = Today.AddDays(checkOut), GuestsCount = 4, Status = status,
        TotalPrice = 175m, SavedCardLast4 = "1234", CancelledAt = status == BookingStatus.Cancelled ? new DateTime(2026, 9, 1) : null
    };

    private static OwnerController Controller(AppDbContext db, int userId = 1, string role = UserRoles.HotelOwner) => new(db, new FixedTimeProvider())
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)], "TestAuth"))
            }
        }
    };

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 9, 15, 20, 5, 0, TimeSpan.Zero);
    }

    private static async Task<AppDbContext> CreateDb()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Users.AddRange(new[] { 1, 2, 4 }.Select(id => new AppUser { Id = id, Name = $"Owner {id}", Email = $"owner{id}@example.com", Role = UserRoles.HotelOwner }));
        db.Hotels.AddRange(
            new Hotel { Id = 1, OwnerId = 1, Name = "Alpha Palace", City = "Baku", ImageUrlsJson = "[\"https://example.com/hotel.jpg\"]" },
            new Hotel { Id = 2, OwnerId = 2, Name = "Hidden Hotel", City = "Baku" },
            new Hotel { Id = 3, OwnerId = 1, Name = "Mountain Retreat", City = "Quba" });
        db.HotelRooms.AddRange(new[] { 1, 2, 3 }.Select(id => new HotelRoom { Id = id * 10, HotelId = id, RoomType = "Standard", Capacity = 4, TotalRooms = 10 }));
        db.HotelRooms.Add(new HotelRoom { Id = 11, HotelId = 1, RoomType = "Family", Capacity = 2, TotalRooms = 50 });
        await db.SaveChangesAsync();
        return db;
    }
}

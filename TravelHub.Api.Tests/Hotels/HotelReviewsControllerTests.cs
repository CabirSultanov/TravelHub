using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Controllers;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;

namespace TravelHub.Api.Tests.Hotels;

public class HotelReviewsControllerTests
{
    [Fact]
    public async Task GetReviews_IsPublicAndReturnsNewestFirstWithPagingAndStats()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 3);
        db.HotelReviews.AddRange(
            Review(1, 1, 3, DateTime.UtcNow.AddDays(-2)),
            Review(1, 2, 5, DateTime.UtcNow.AddHours(-1)),
            Review(1, 3, 4, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var result = await new HotelReviewsController(db).GetReviews(1, page: 1, pageSize: 2);
        var response = result.Value!;

        Assert.Equal(3, response.TotalItems);
        Assert.Equal(2, response.TotalPages);
        Assert.Equal(4d, response.AverageRating);
        Assert.Equal([3, 2], response.Items.Select(review => review.UserId));
    }

    [Fact]
    public async Task GetReviews_UsesThreeItemDefaultPageSizeAndKeepsAccurateStats()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 4);
        db.HotelReviews.AddRange(
            Review(1, 1, 2, DateTime.UtcNow.AddMinutes(-4)),
            Review(1, 2, 3, DateTime.UtcNow.AddMinutes(-3)),
            Review(1, 3, 4, DateTime.UtcNow.AddMinutes(-2)),
            Review(1, 4, 5, DateTime.UtcNow.AddMinutes(-1)));
        await db.SaveChangesAsync();
        var controller = new HotelReviewsController(db);

        var firstPage = (await controller.GetReviews(1)).Value!;
        var secondPage = (await controller.GetReviews(1, page: 2)).Value!;

        Assert.Equal(3, firstPage.PageSize);
        Assert.Equal(2, firstPage.TotalPages);
        Assert.Equal([4, 3, 2], firstPage.Items.Select(review => review.UserId));
        Assert.Equal([1], secondPage.Items.Select(review => review.UserId));
        Assert.Equal(3.5d, firstPage.AverageRating);
        Assert.Equal(4, firstPage.ReviewCount);

        db.HotelReviews.Remove(db.HotelReviews.Single(review => review.UserId == 1));
        await db.SaveChangesAsync();

        var pageAfterDeletingLastItem = (await controller.GetReviews(1, page: 2)).Value!;
        Assert.Equal(1, pageAfterDeletingLastItem.Page);
        Assert.Equal(3, pageAfterDeletingLastItem.Items.Count);
    }

    [Fact]
    public async Task GetReviews_ReturnsEmptyStatisticsForAHotelWithoutReviews()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);

        var response = (await new HotelReviewsController(db).GetReviews(1)).Value!;

        Assert.Equal(0, response.ReviewCount);
        Assert.Null(response.AverageRating);
    }

    [Fact]
    public async Task GetReviews_ReturnsTheCurrentUsersReviewCount()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);
        db.HotelReviews.Add(Review(1, 1, 5, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var response = (await CreateController(db, 1).GetReviews(1)).Value!;

        Assert.Equal(1, response.CurrentUserReviewCount);
    }

    [Fact]
    public async Task CreateReview_RequiresAuthenticatedUser()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);

        var result = await new HotelReviewsController(db).CreateReview(1, new HotelReviewCreateDto { Rating = 5 });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task CreateReview_AcceptsBoundaryRatings(int rating)
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);

        var result = await CreateController(db, 1).CreateReview(1, new HotelReviewCreateDto { Rating = rating, Comment = "  Nice stay.  " });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var review = Assert.IsType<HotelReviewResponseDto>(created.Value);
        Assert.Equal(rating, review.Rating);
        Assert.Equal("Nice stay.", review.Comment);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task CreateReview_RejectsInvalidRating(int rating)
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);

        var result = await CreateController(db, 1).CreateReview(1, new HotelReviewCreateDto { Rating = rating });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateReview_AllowsEmptyCommentButRejectsLongComment()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 2);
        var controller = CreateController(db, 1);

        var emptyResult = await controller.CreateReview(1, new HotelReviewCreateDto { Rating = 5, Comment = "  " });
        var longResult = await CreateController(db, 2).CreateReview(1, new HotelReviewCreateDto { Rating = 5, Comment = new string('a', 1001) });

        var created = Assert.IsType<CreatedAtActionResult>(emptyResult.Result);
        Assert.Null(Assert.IsType<HotelReviewResponseDto>(created.Value).Comment);
        Assert.IsType<BadRequestObjectResult>(longResult.Result);
    }

    [Fact]
    public async Task CreateReview_EnforcesOneReviewPerUserAndHotel()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 2);
        db.Hotels.Add(new Hotel { Id = 2, Name = "Gabala Stay", City = "Gabala" });
        await db.SaveChangesAsync();
        var controller = CreateController(db, 1);

        var first = await controller.CreateReview(1, new HotelReviewCreateDto { Rating = 4 });
        var duplicate = await controller.CreateReview(1, new HotelReviewCreateDto { Rating = 5 });
        var otherHotel = await controller.CreateReview(2, new HotelReviewCreateDto { Rating = 5 });
        var otherUser = await CreateController(db, 2).CreateReview(1, new HotelReviewCreateDto { Rating = 3 });

        Assert.IsType<CreatedAtActionResult>(first.Result);
        var conflict = Assert.IsType<ConflictObjectResult>(duplicate.Result);
        Assert.Equal("You have already reviewed this hotel.", conflict.Value);
        Assert.IsType<CreatedAtActionResult>(otherHotel.Result);
        Assert.IsType<CreatedAtActionResult>(otherUser.Result);
        Assert.Equal(3, await db.HotelReviews.CountAsync());
    }

    [Fact]
    public async Task UpdateReview_AllowsOnlyOwnerAndSetsUpdatedAt()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 2);
        var review = Review(1, 1, 3, DateTime.UtcNow.AddDays(-1));
        db.HotelReviews.Add(review);
        await db.SaveChangesAsync();

        var forbidden = await CreateController(db, 2).UpdateReview(1, review.Id, new HotelReviewUpdateDto { Rating = 5 });
        var updated = await CreateController(db, 1).UpdateReview(1, review.Id, new HotelReviewUpdateDto { Rating = 5, Comment = "Updated" });

        Assert.IsType<ForbidResult>(forbidden.Result);
        var response = Assert.IsType<HotelReviewResponseDto>(updated.Value);
        Assert.Equal(5, response.Rating);
        Assert.Equal("Updated", response.Comment);
        Assert.NotNull(response.UpdatedAt);
        Assert.Equal(review.CreatedAt, response.CreatedAt);
    }

    [Fact]
    public async Task DeleteReview_AllowsOwnerAndAdminButNotAnotherUser()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 3);
        var review = Review(1, 1, 5, DateTime.UtcNow);
        db.HotelReviews.Add(review);
        await db.SaveChangesAsync();

        var forbidden = await CreateController(db, 2).DeleteReview(1, review.Id);
        var adminDelete = await CreateController(db, 3, UserRoles.Admin).DeleteReview(1, review.Id);

        Assert.IsType<ForbidResult>(forbidden);
        Assert.IsType<NoContentResult>(adminDelete);
        Assert.Empty(await db.HotelReviews.ToListAsync());
    }

    [Fact]
    public async Task DeleteReview_AllowsOwnerToDeleteOwnReview()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 1);
        var review = Review(1, 1, 5, DateTime.UtcNow);
        db.HotelReviews.Add(review);
        await db.SaveChangesAsync();

        var result = await CreateController(db, 1).DeleteReview(1, review.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(await db.HotelReviews.ToListAsync());
    }

    [Fact]
    public async Task HotelResponses_IncludeReviewAggregates()
    {
        await using var db = CreateDb();
        SeedHotelAndUsers(db, 2);
        db.HotelReviews.AddRange(Review(1, 1, 4, DateTime.UtcNow), Review(1, 2, 5, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var controller = new HotelsController(db);

        var list = (await controller.GetHotels()).Value!;
        var detail = (await controller.GetHotel(1)).Value!;

        Assert.Equal(4.5d, list.Items.Single().AverageRating);
        Assert.Equal(2, list.Items.Single().ReviewCount);
        Assert.Equal(4.5d, detail.AverageRating);
        Assert.Equal(2, detail.ReviewCount);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static HotelReviewsController CreateController(AppDbContext db, int userId, string role = UserRoles.User)
    {
        var controller = new HotelReviewsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)],
                    "TestAuth"))
            }
        };
        return controller;
    }

    private static void SeedHotelAndUsers(AppDbContext db, int userCount)
    {
        db.Hotels.Add(new Hotel { Id = 1, Name = "Baku Stay", City = "Baku" });

        for (var userId = 1; userId <= userCount; userId++)
        {
            db.Users.Add(new AppUser
            {
                Id = userId,
                Name = $"User {userId}",
                Email = $"user{userId}@gmail.com",
                PhoneNumber = "+994501234567",
                PasswordHash = "hash"
            });
        }

        db.SaveChanges();
    }

    private static HotelReview Review(int hotelId, int userId, int rating, DateTime createdAt) => new()
    {
        HotelId = hotelId,
        UserId = userId,
        Rating = rating,
        CreatedAt = createdAt
    };
}

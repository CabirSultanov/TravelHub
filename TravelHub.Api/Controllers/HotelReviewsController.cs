using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.DTO;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Controllers;

[ApiController]
[Route("api/hotels/{hotelId:int}/reviews")]
public class HotelReviewsController(AppDbContext db) : ControllerBase
{
    private const int DefaultPageSize = 3;
    private const int MaxPageSize = 100;
    private const int MaxReviewsPerUser = 3;

    [HttpGet]
    public async Task<ActionResult<HotelReviewsResponseDto>> GetReviews(int hotelId, int page = 1, int pageSize = DefaultPageSize)
    {
        if (!await db.Hotels.AsNoTracking().AnyAsync(hotel => hotel.Id == hotelId))
        {
            return NotFound();
        }

        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var query = db.HotelReviews.AsNoTracking().Where(review => review.HotelId == hotelId);
        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)normalizedPageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(normalizedPage, totalPages);
        var currentUserId = GetCurrentUserId();
        int? currentUserReviewCount = currentUserId.HasValue
            ? await query.CountAsync(review => review.UserId == currentUserId.Value)
            : null;
        var averageRating = totalItems == 0
            ? null
            : await query.AverageAsync(review => (double?)review.Rating);
        var items = await query
            .OrderByDescending(review => review.CreatedAt)
            .ThenByDescending(review => review.Id)
            .Skip((effectivePage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .Select(review => new HotelReviewResponseDto
            {
                Id = review.Id,
                HotelId = review.HotelId,
                UserId = review.UserId,
                UserName = review.User.Name,
                Rating = review.Rating,
                Comment = review.Comment,
                CreatedAt = review.CreatedAt,
                UpdatedAt = review.UpdatedAt
            })
            .ToListAsync();

        return new HotelReviewsResponseDto
        {
            Items = items,
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalItems = totalItems,
            TotalPages = totalPages,
            AverageRating = averageRating,
            ReviewCount = totalItems,
            CurrentUserReviewCount = currentUserReviewCount
        };
    }

    [Authorize]
    [HttpGet("mine")]
    public async Task<ActionResult<HotelReviewResponseDto>> GetMyReview(int hotelId)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var review = await db.HotelReviews.AsNoTracking()
            .Where(review => review.HotelId == hotelId && review.UserId == userId.Value)
            .OrderByDescending(review => review.CreatedAt)
            .ThenByDescending(review => review.Id)
            .Select(review => new HotelReviewResponseDto
            {
                Id = review.Id,
                HotelId = review.HotelId,
                UserId = review.UserId,
                UserName = review.User.Name,
                Rating = review.Rating,
                Comment = review.Comment,
                CreatedAt = review.CreatedAt,
                UpdatedAt = review.UpdatedAt
            })
            .FirstOrDefaultAsync();

        return review is null ? NotFound() : review;
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<HotelReviewResponseDto>> CreateReview(int hotelId, HotelReviewCreateDto reviewDto)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        if (!await db.Hotels.AnyAsync(hotel => hotel.Id == hotelId))
        {
            return NotFound();
        }

        var validationError = HotelReviewRules.Validate(reviewDto.Rating, reviewDto.Comment, out var comment);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        if (await db.HotelReviews.CountAsync(review => review.HotelId == hotelId && review.UserId == userId.Value) >= MaxReviewsPerUser)
        {
            return Conflict("You can submit up to 3 reviews for this hotel.");
        }

        var review = new HotelReview
        {
            HotelId = hotelId,
            UserId = userId.Value,
            Rating = reviewDto.Rating,
            Comment = comment,
            CreatedAt = DateTime.UtcNow
        };

        db.HotelReviews.Add(review);
        await db.SaveChangesAsync();

        await db.Entry(review).Reference(currentReview => currentReview.User).LoadAsync();
        return CreatedAtAction(nameof(GetReviews), new { hotelId }, ToResponse(review));
    }

    [Authorize]
    [HttpPut("{reviewId:int}")]
    public async Task<ActionResult<HotelReviewResponseDto>> UpdateReview(int hotelId, int reviewId, HotelReviewUpdateDto reviewDto)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var review = await db.HotelReviews
            .Include(currentReview => currentReview.User)
            .FirstOrDefaultAsync(currentReview => currentReview.Id == reviewId && currentReview.HotelId == hotelId);

        if (review is null)
        {
            return NotFound();
        }

        if (review.UserId != userId.Value)
        {
            return Forbid();
        }

        var validationError = HotelReviewRules.Validate(reviewDto.Rating, reviewDto.Comment, out var comment);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        review.Rating = reviewDto.Rating;
        review.Comment = comment;
        review.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return ToResponse(review);
    }

    [Authorize]
    [HttpDelete("{reviewId:int}")]
    public async Task<IActionResult> DeleteReview(int hotelId, int reviewId)
    {
        var review = await db.HotelReviews
            .FirstOrDefaultAsync(currentReview => currentReview.Id == reviewId && currentReview.HotelId == hotelId);

        if (review is null)
        {
            return NotFound();
        }

        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        if (review.UserId != userId.Value && !IsAdmin())
        {
            return Forbid();
        }

        db.HotelReviews.Remove(review);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static HotelReviewResponseDto ToResponse(HotelReview review) => new()
    {
        Id = review.Id,
        HotelId = review.HotelId,
        UserId = review.UserId,
        UserName = review.User.Name,
        Rating = review.Rating,
        Comment = review.Comment,
        CreatedAt = review.CreatedAt,
        UpdatedAt = review.UpdatedAt
    };

    private bool IsAdmin() => User?.IsInRole(UserRoles.Admin) == true || User?.IsInRole(UserRoles.SuperAdmin) == true;

    private int? GetCurrentUserId()
    {
        var value = User?.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userId) ? userId : null;
    }
}

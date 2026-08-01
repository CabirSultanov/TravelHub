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
[Authorize]
[Route("api/payment-cards")]
public class PaymentCardsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PaymentCardResponseDto>>> GetPaymentCards()
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        return await db.SavedPaymentCards
            .AsNoTracking()
            .Where(card => card.UserId == userId.Value)
            .OrderByDescending(card => card.Id)
            .Select(card => new PaymentCardResponseDto
            {
                Id = card.Id,
                CardHolderName = card.CardHolderName,
                Brand = card.Brand,
                Last4 = card.Last4,
                ExpiryMonth = card.ExpiryMonth,
                ExpiryYear = card.ExpiryYear
            })
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<PaymentCardResponseDto>> CreatePaymentCard(PaymentCardCreateDto cardDto)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var validationError = PaymentCardRules.CreateCard(
            cardDto.CardNumber,
            cardDto.CardHolderName,
            cardDto.ExpiryMonth,
            cardDto.ExpiryYear,
            cardDto.Cvv,
            out var cardDraft);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var card = new SavedPaymentCard
        {
            UserId = userId.Value,
            CardHolderName = cardDraft.CardHolderName,
            Brand = cardDraft.Brand,
            Last4 = cardDraft.Last4,
            ExpiryMonth = cardDraft.ExpiryMonth,
            ExpiryYear = cardDraft.ExpiryYear,
            Token = cardDraft.Token
        };

        db.SavedPaymentCards.Add(card);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPaymentCards), ToResponse(card));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePaymentCard(int id)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var card = await db.SavedPaymentCards.FirstOrDefaultAsync(card => card.Id == id && card.UserId == userId.Value);

        if (card is null)
        {
            return NotFound();
        }

        db.SavedPaymentCards.Remove(card);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static PaymentCardResponseDto ToResponse(SavedPaymentCard card) => new()
    {
        Id = card.Id,
        CardHolderName = card.CardHolderName,
        Brand = card.Brand,
        Last4 = card.Last4,
        ExpiryMonth = card.ExpiryMonth,
        ExpiryYear = card.ExpiryYear
    };

    private int? GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userId) ? userId : null;
    }
}

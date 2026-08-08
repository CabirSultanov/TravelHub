using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Payments;

public class PaymentCardRulesTests
{
    [Fact]
    public void CreateCard_WithValidData_ReturnsCardDraft()
    {
        var error = PaymentCardRules.CreateCard(
            " 4111 1111 1111 1111 ",
            " Jane Doe ",
            12,
            2099,
            " 123 ",
            out var card);

        Assert.Null(error);
        Assert.Equal("Jane Doe", card.CardHolderName);
        Assert.Equal("Visa", card.Brand);
        Assert.Equal("1111", card.Last4);
        Assert.Equal(12, card.ExpiryMonth);
        Assert.Equal(2099, card.ExpiryYear);
        Assert.NotEmpty(card.Token);
    }

    [Theory]
    [InlineData("1234", 12, 2099, "123", "CardNumber must contain exactly 16 digits.")]
    [InlineData("4111111111111111", 0, 2099, "123", "ExpiryMonth must be between 1 and 12.")]
    [InlineData("4111111111111111", 12, 2099, "12", "CVV must contain 3 or 4 digits.")]
    public void CreateCard_WhenInputIsInvalid_ReturnsExpectedError(
        string cardNumber,
        int expiryMonth,
        int expiryYear,
        string cvv,
        string expectedError)
    {
        var error = PaymentCardRules.CreateCard(
            cardNumber,
            "Jane Doe",
            expiryMonth,
            expiryYear,
            cvv,
            out _);

        Assert.Equal(expectedError, error);
    }

    [Fact]
    public void IsExpired_WithPastAndFutureDates_ReturnsExpectedResult()
    {
        Assert.True(PaymentCardRules.IsExpired(12, 2000));
        Assert.False(PaymentCardRules.IsExpired(12, 2099));
    }
}

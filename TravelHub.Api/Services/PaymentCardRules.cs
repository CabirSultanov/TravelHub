namespace TravelHub.Api.Services;

public readonly record struct PaymentCardDraft(
    string CardHolderName,
    string Brand,
    string Last4,
    int ExpiryMonth,
    int ExpiryYear,
    string Token);

public static class PaymentCardRules
{
    public static string? CreateCard(
        string? cardNumber,
        string? cardHolderName,
        int expiryMonth,
        int expiryYear,
        string? cvv,
        out PaymentCardDraft card)
    {
        card = default;

        var holderName = cardHolderName?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(holderName))
        {
            return "Card holder is required.";
        }

        var number = cardNumber?.Trim() ?? string.Empty;

        if (number.Any(character => !char.IsDigit(character) && !char.IsWhiteSpace(character)))
        {
            return "CardNumber must contain exactly 16 digits.";
        }

        var digits = new string(number.Where(char.IsDigit).ToArray());

        if (digits.Length != 16)
        {
            return "CardNumber must contain exactly 16 digits.";
        }

        if (expiryMonth is < 1 or > 12)
        {
            return "ExpiryMonth must be between 1 and 12.";
        }

        var now = DateTime.UtcNow;

        if (expiryYear < now.Year || (expiryYear == now.Year && expiryMonth < now.Month))
        {
            return "Card expiry date cannot be in the past.";
        }

        var cvvDigits = cvv?.Trim() ?? string.Empty;

        if (cvvDigits.Length is not (3 or 4) || cvvDigits.Any(character => !char.IsDigit(character)))
        {
            return "CVV must contain 3 or 4 digits.";
        }

        card = new PaymentCardDraft(
            holderName,
            digits[0] == '4' ? "Visa" : digits[0] == '5' ? "Mastercard" : "Card",
            digits[^4..],
            expiryMonth,
            expiryYear,
            Guid.NewGuid().ToString("N"));

        return null;
    }

    public static bool IsExpired(int expiryMonth, int expiryYear)
    {
        var now = DateTime.UtcNow;
        return expiryYear < now.Year || (expiryYear == now.Year && expiryMonth < now.Month);
    }
}

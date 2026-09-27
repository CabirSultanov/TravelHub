namespace TravelHub.Api.Services;

public static class HotelReviewRules
{
    public const int MaxCommentLength = 1000;

    public static string? Validate(int rating, string? comment, out string? normalizedComment)
    {
        normalizedComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();

        if (rating is < 1 or > 5)
        {
            return "Rating must be an integer from 1 to 5.";
        }

        return normalizedComment?.Length > MaxCommentLength
            ? $"Comment must be {MaxCommentLength} characters or fewer."
            : null;
    }
}

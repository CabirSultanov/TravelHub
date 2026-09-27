using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public static class RefreshTokenRules
{
    public static bool IsUsable(RefreshToken token, DateTime now) =>
        token.RevokedAt is null && token.ExpiresAt > now;

    public static bool TryRevokeForRotation(RefreshToken token, string replacedByTokenHash, DateTime now)
    {
        if (!IsUsable(token, now))
        {
            return false;
        }

        token.RevokedAt = now;
        token.ReplacedByTokenHash = replacedByTokenHash;
        return true;
    }

    public static bool CanReplayWithinGracePeriod(RefreshToken token, DateTime now, TimeSpan gracePeriod) =>
        token.ExpiresAt > now
        && token.RevokedAt is { } revokedAt
        && now >= revokedAt
        && now - revokedAt <= gracePeriod
        && !string.IsNullOrWhiteSpace(token.ReplacedByTokenHash)
        && !string.IsNullOrWhiteSpace(token.ProtectedReplacementToken);
}

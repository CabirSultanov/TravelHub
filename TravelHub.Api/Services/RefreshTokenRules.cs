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
}

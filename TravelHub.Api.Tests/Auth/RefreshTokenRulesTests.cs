using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Auth;

public class RefreshTokenRulesTests
{
    [Fact]
    public void IsUsable_ReturnsFalseForExpiredOrRevokedToken()
    {
        var now = new DateTime(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
        var expired = new RefreshToken { ExpiresAt = now.AddSeconds(-1) };
        var revoked = new RefreshToken { ExpiresAt = now.AddMinutes(5), RevokedAt = now };

        Assert.False(RefreshTokenRules.IsUsable(expired, now));
        Assert.False(RefreshTokenRules.IsUsable(revoked, now));
    }

    [Fact]
    public void TryRevokeForRotation_RevokesTokenAndPreventsReuse()
    {
        var now = new DateTime(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
        var token = new RefreshToken { ExpiresAt = now.AddMinutes(5) };
        const string replacementHash = "replacement-hash";

        Assert.True(RefreshTokenRules.TryRevokeForRotation(token, replacementHash, now));
        Assert.Equal(now, token.RevokedAt);
        Assert.Equal(replacementHash, token.ReplacedByTokenHash);
        Assert.False(RefreshTokenRules.TryRevokeForRotation(token, "another-hash", now));
    }
}

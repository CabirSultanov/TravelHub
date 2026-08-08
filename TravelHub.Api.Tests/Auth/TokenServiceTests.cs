using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using TravelHub.Api.Configuration;
using TravelHub.Api.Models;
using TravelHub.Api.Services;

namespace TravelHub.Api.Tests.Auth;

public class TokenServiceTests
{
    private static readonly JwtOptions Options = new()
    {
        Issuer = "TravelHub",
        Audience = "TravelHub.Client",
        Key = new string('k', 64),
        AccessTokenMinutes = 15,
        RefreshTokenDays = 7
    };

    [Fact]
    public void CreateAccessToken_ContainsIdentityClaimsAndExpiration()
    {
        var service = new TokenService(Microsoft.Extensions.Options.Options.Create(Options));
        var user = new AppUser
        {
            Id = 42,
            Name = "Jane Doe",
            Email = "jane@example.com",
            Role = UserRoles.Admin
        };

        var result = service.CreateAccessToken(user);
        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);

        Assert.Equal("42", token.Claims.Single(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
        Assert.Equal("jane@example.com", token.Claims.Single(claim => claim.Type == ClaimTypes.Email).Value);
        Assert.Equal(UserRoles.Admin, token.Claims.Single(claim => claim.Type == ClaimTypes.Role).Value);
        Assert.Equal(Options.Issuer, token.Issuer);
        Assert.Equal(Options.Audience, token.Audiences.Single());
        Assert.True(result.ExpiresAt > DateTime.UtcNow.AddMinutes(14));
        Assert.True(result.ExpiresAt <= DateTime.UtcNow.AddMinutes(15).AddSeconds(1));
        Assert.Equal(result.ExpiresAt, token.ValidTo, precision: TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void CreateRefreshToken_GeneratesDifferentSufficientlyRandomValues()
    {
        var service = CreateService();

        var first = service.CreateRefreshToken();
        var second = service.CreateRefreshToken();

        Assert.NotEqual(first, second);
        Assert.Equal(128, first.Length);
        Assert.Equal(128, second.Length);
    }

    [Fact]
    public void HashRefreshToken_IsDeterministicAndDoesNotEqualRawToken()
    {
        var service = CreateService();
        const string rawToken = "refresh-token";

        var firstHash = service.HashRefreshToken(rawToken);
        var secondHash = service.HashRefreshToken(rawToken);

        Assert.Equal(firstHash, secondHash);
        Assert.Equal(64, firstHash.Length);
        Assert.NotEqual(rawToken, firstHash);
    }

    private static TokenService CreateService() =>
        new(Microsoft.Extensions.Options.Options.Create(Options));
}

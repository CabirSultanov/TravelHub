using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public interface ITokenService
{
    AccessTokenResult CreateAccessToken(AppUser user);

    string CreateRefreshToken();

    string HashRefreshToken(string token);
}

public sealed record AccessTokenResult(string Token, DateTime ExpiresAt);

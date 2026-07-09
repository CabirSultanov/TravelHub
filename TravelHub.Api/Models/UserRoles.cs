namespace TravelHub.Api.Models;

public static class UserRoles
{
    public const string User = "User";
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";
    public const string AdminOrSuperAdmin = Admin + "," + SuperAdmin;
}

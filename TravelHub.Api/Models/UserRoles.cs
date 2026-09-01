namespace TravelHub.Api.Models;

public static class UserRoles
{
    public const string User = "User";
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";
    public const string HotelOwner = "HotelOwner";
    public const string TaxiOwner = "TaxiOwner";
    public const string AdminOrSuperAdmin = Admin + "," + SuperAdmin;
    public const string AdminOrSuperAdminOrHotelOwner = AdminOrSuperAdmin + "," + HotelOwner;
    public const string AdminOrSuperAdminOrTaxiOwner = AdminOrSuperAdmin + "," + TaxiOwner;
}

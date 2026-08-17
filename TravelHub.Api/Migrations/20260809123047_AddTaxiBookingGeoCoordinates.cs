using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxiBookingGeoCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DropoffLatitude",
                table: "TaxiBookings",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DropoffLongitude",
                table: "TaxiBookings",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PickupLatitude",
                table: "TaxiBookings",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PickupLongitude",
                table: "TaxiBookings",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DropoffLatitude",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "DropoffLongitude",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "PickupLatitude",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "PickupLongitude",
                table: "TaxiBookings");
        }
    }
}

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TravelHub.Api.Data;

#nullable disable

namespace TravelHub.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260901160000_AddTaxiDrivers")]
public partial class AddTaxiDrivers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "TaxiServiceId",
            table: "Users",
            type: "int",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Users_TaxiServiceId",
            table: "Users",
            column: "TaxiServiceId");

        migrationBuilder.AddForeignKey(
            name: "FK_Users_TaxiServices_TaxiServiceId",
            table: "Users",
            column: "TaxiServiceId",
            principalTable: "TaxiServices",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_Users_TaxiServices_TaxiServiceId", table: "Users");
        migrationBuilder.DropIndex(name: "IX_Users_TaxiServiceId", table: "Users");
        migrationBuilder.DropColumn(name: "TaxiServiceId", table: "Users");
    }
}

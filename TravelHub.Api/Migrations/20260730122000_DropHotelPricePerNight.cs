using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TravelHub.Api.Data;

#nullable disable

namespace TravelHub.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260730122000_DropHotelPricePerNight")]
public partial class DropHotelPricePerNight : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PricePerNight",
            table: "Hotels");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "PricePerNight",
            table: "Hotels",
            type: "decimal(18,2)",
            precision: 18,
            scale: 2,
            nullable: false,
            defaultValue: 0m);
    }
}

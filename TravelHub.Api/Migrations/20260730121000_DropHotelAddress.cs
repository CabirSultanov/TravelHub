using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TravelHub.Api.Data;

#nullable disable

namespace TravelHub.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260730121000_DropHotelAddress")]
public partial class DropHotelAddress : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Address",
            table: "Hotels");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Address",
            table: "Hotels",
            type: "nvarchar(250)",
            maxLength: 250,
            nullable: false,
            defaultValue: "");
    }
}

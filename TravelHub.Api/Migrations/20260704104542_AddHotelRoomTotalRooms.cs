using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHotelRoomTotalRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TotalRooms",
                table: "HotelRooms",
                type: "int",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalRooms",
                table: "HotelRooms");
        }
    }
}

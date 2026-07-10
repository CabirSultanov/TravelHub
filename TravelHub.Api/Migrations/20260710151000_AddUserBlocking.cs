using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    [Migration("20260710151000_AddUserBlocking")]
    public partial class AddUserBlocking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBlocked",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsBlocked",
                table: "Users");
        }
    }
}

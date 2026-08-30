using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenReplayProtection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProtectedReplacementToken",
                table: "RefreshTokens",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProtectedReplacementToken",
                table: "RefreshTokens");
        }
    }
}

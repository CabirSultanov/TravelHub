using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class RestoreOneHotelReviewPerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HotelReviews_UserId_HotelId",
                table: "HotelReviews");

            migrationBuilder.CreateIndex(
                name: "IX_HotelReviews_UserId_HotelId",
                table: "HotelReviews",
                columns: new[] { "UserId", "HotelId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HotelReviews_UserId_HotelId",
                table: "HotelReviews");

            migrationBuilder.CreateIndex(
                name: "IX_HotelReviews_UserId_HotelId",
                table: "HotelReviews",
                columns: new[] { "UserId", "HotelId" });
        }
    }
}

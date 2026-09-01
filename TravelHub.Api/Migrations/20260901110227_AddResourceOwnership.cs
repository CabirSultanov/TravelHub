using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddResourceOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OwnerId",
                table: "TaxiServices",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OwnerId",
                table: "Hotels",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaxiServices_OwnerId",
                table: "TaxiServices",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Hotels_OwnerId",
                table: "Hotels",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Hotels_Users_OwnerId",
                table: "Hotels",
                column: "OwnerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaxiServices_Users_OwnerId",
                table: "TaxiServices",
                column: "OwnerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Hotels_Users_OwnerId",
                table: "Hotels");

            migrationBuilder.DropForeignKey(
                name: "FK_TaxiServices_Users_OwnerId",
                table: "TaxiServices");

            migrationBuilder.DropIndex(
                name: "IX_TaxiServices_OwnerId",
                table: "TaxiServices");

            migrationBuilder.DropIndex(
                name: "IX_Hotels_OwnerId",
                table: "Hotels");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "TaxiServices");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Hotels");
        }
    }
}

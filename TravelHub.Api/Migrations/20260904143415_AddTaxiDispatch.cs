using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxiDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "TaxiBookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ArrivedAt",
                table: "TaxiBookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "TaxiBookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DriverId",
                table: "TaxiBookings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentToken",
                table: "TaxiBookings",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "TaxiBookings",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.CreateTable(
                name: "TaxiBookingDriverDeclines",
                columns: table => new
                {
                    TaxiBookingId = table.Column<int>(type: "int", nullable: false),
                    DriverId = table.Column<int>(type: "int", nullable: false),
                    DeclinedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxiBookingDriverDeclines", x => new { x.TaxiBookingId, x.DriverId });
                    table.ForeignKey(
                        name: "FK_TaxiBookingDriverDeclines_TaxiBookings_TaxiBookingId",
                        column: x => x.TaxiBookingId,
                        principalTable: "TaxiBookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaxiBookingDriverDeclines_Users_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaxiBookings_DriverId",
                table: "TaxiBookings",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxiBookingDriverDeclines_DriverId",
                table: "TaxiBookingDriverDeclines",
                column: "DriverId");

            migrationBuilder.AddForeignKey(
                name: "FK_TaxiBookings_Users_DriverId",
                table: "TaxiBookings",
                column: "DriverId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaxiBookings_Users_DriverId",
                table: "TaxiBookings");

            migrationBuilder.DropTable(
                name: "TaxiBookingDriverDeclines");

            migrationBuilder.DropIndex(
                name: "IX_TaxiBookings_DriverId",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "ArrivedAt",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "DriverId",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "PaymentToken",
                table: "TaxiBookings");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "TaxiBookings");
        }
    }
}

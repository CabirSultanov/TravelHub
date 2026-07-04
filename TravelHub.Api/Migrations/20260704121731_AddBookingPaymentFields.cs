using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingPaymentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "BookingRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                table: "BookingRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SavedCardLast4",
                table: "BookingRequests",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "BookingRequests");

            migrationBuilder.DropColumn(
                name: "PaidAt",
                table: "BookingRequests");

            migrationBuilder.DropColumn(
                name: "SavedCardLast4",
                table: "BookingRequests");
        }
    }
}

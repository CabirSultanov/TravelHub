using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxiCarClasses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaxiCarClasses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaxiServiceId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PricePerKm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxiCarClasses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxiCarClasses_TaxiServices_TaxiServiceId",
                        column: x => x.TaxiServiceId,
                        principalTable: "TaxiServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaxiCarClasses_TaxiServiceId",
                table: "TaxiCarClasses",
                column: "TaxiServiceId");

            migrationBuilder.Sql("""
                INSERT INTO TaxiCarClasses (TaxiServiceId, Name, PricePerKm)
                SELECT Id, N'Standard', PricePerKm
                FROM TaxiServices
                """);

            migrationBuilder.DropColumn(
                name: "PricePerKm",
                table: "TaxiServices");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PricePerKm",
                table: "TaxiServices",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql("""
                UPDATE taxiService
                SET PricePerKm = carClass.PricePerKm
                FROM TaxiServices taxiService
                INNER JOIN (
                    SELECT TaxiServiceId, PricePerKm, ROW_NUMBER() OVER (PARTITION BY TaxiServiceId ORDER BY Id) AS RowNumber
                    FROM TaxiCarClasses
                ) carClass ON carClass.TaxiServiceId = taxiService.Id AND carClass.RowNumber = 1
                """);

            migrationBuilder.DropTable(
                name: "TaxiCarClasses");
        }
    }
}

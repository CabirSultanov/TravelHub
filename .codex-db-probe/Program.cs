using System.Text.Json;
using Microsoft.Data.SqlClient;

var secretPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
    "Microsoft",
    "UserSecrets",
    "facd1d2f-51b4-4ba5-b66d-0a2cac2bb8ce",
    "secrets.json");

using var secrets = JsonDocument.Parse(await File.ReadAllTextAsync(secretPath));
var root = secrets.RootElement;
var connectionString = root.TryGetProperty("ConnectionStrings:DefaultConnection", out var flat)
    ? flat.GetString()
    : root.GetProperty("ConnectionStrings").GetProperty("DefaultConnection").GetString();

await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();

await using var command = connection.CreateCommand();
command.CommandText = """
SET NOCOUNT ON;
SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'TaxiBookings'
  AND COLUMN_NAME = 'Status';

SELECT TOP (10) Id, UserId, Status, PaidAt, CancelledAt, SavedCardLast4
FROM dbo.TaxiBookings
ORDER BY Id DESC;
""";

await using var reader = await command.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    var length = await reader.IsDBNullAsync(1) ? "null" : reader.GetInt32(1).ToString();
    Console.WriteLine($"StatusColumn: type={reader.GetString(0)} length={length}");
}

await reader.NextResultAsync();
while (await reader.ReadAsync())
{
    var paidAt = await reader.IsDBNullAsync(3) ? "null" : reader.GetDateTime(3).ToString("s");
    var cancelledAt = await reader.IsDBNullAsync(4) ? "null" : reader.GetDateTime(4).ToString("s");
    var last4 = await reader.IsDBNullAsync(5) ? "null" : reader.GetString(5);
    Console.WriteLine(
        $"TaxiBooking: id={reader.GetInt32(0)} user={reader.GetInt32(1)} status={reader.GetValue(2)} paidAt={paidAt} cancelledAt={cancelledAt} last4={last4}");
}

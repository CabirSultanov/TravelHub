using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("GetHealth")
    .WithOpenApi();

app.MapGet("/health/db", async () =>
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync();

    await using var command = new SqlCommand("SELECT 1", connection);
    var result = await command.ExecuteScalarAsync();

    return Results.Ok(new { status = "ok", database = "connected", result });
})
    .WithName("GetDatabaseHealth")
    .WithOpenApi();

app.Run();

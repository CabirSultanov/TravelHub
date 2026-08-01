using TravelHub.Api.Data;
using TravelHub.Api.Configuration;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddTravelHubServices(builder.Configuration);

var app = builder.Build();

if (!await app.InitializeDatabaseAsync())
{
    return;
}

app.UseTravelHubPipeline();
app.MapTravelHubEndpoints();
app.Run();

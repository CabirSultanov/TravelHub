using TravelHub.Api.Data;
using TravelHub.Api.Configuration;
using TravelHub.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddTravelHubServices(builder.Configuration);

var app = builder.Build();

if (args.Length == 1 && args[0] is "--migrate-local-images" or "--migrate-local-images-dry-run")
{
    var apply = args[0] == "--migrate-local-images";
    Environment.ExitCode = await LocalImageMigration.RunAsync(app.Services, app.Environment.ContentRootPath, apply, CancellationToken.None);
    return;
}

if (!await app.InitializeDatabaseAsync())
{
    return;
}

app.UseTravelHubPipeline();
app.MapTravelHubEndpoints();
app.Run();

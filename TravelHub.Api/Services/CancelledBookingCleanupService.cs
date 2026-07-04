using Microsoft.EntityFrameworkCore;
using TravelHub.Api.Data;
using TravelHub.Api.Models;

namespace TravelHub.Api.Services;

public class CancelledBookingCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<CancelledBookingCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CleanupInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await CleanupAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cutoff = DateTime.UtcNow.AddHours(-1);

        var deletedCount = await db.BookingRequests
            .Where(booking =>
                booking.Status == BookingStatus.Cancelled
                && booking.CancelledAt != null
                && booking.CancelledAt <= cutoff)
            .ExecuteDeleteAsync(cancellationToken);

        if (deletedCount > 0)
        {
            logger.LogInformation("Deleted {Count} cancelled booking requests.", deletedCount);
        }
    }
}

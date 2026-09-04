namespace TravelHub.Api.Models;

public enum TaxiBookingStatus
{
    // Legacy values are preserved so existing taxi bookings remain readable.
    PendingPayment,
    Paid,
    Cancelled,
    AwaitingDriver,
    DriverAssigned,
    DriverArrived,
    Completed
}

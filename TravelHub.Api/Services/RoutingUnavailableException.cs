namespace TravelHub.Api.Services;

public class RoutingUnavailableException(string message, Exception? innerException = null) : Exception(message, innerException);

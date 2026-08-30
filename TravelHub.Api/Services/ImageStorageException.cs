namespace TravelHub.Api.Services;

public sealed class ImageStorageException(string message, Exception? innerException = null) : Exception(message, innerException);

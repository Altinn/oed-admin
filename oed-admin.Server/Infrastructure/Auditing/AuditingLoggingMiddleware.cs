using Microsoft.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using oed_admin.Server.Infrastructure.Auditing.Loggers;

namespace oed_admin.Server.Infrastructure.Auditing;

public class AuditingLoggingMiddleware(
    RequestDelegate next,
    IAuditLogger auditLogger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        var requestBody = await GetRequestBody(context.Request);
        var estateId = context.GetRouteValue("estateId")?.ToString();

        if (endpoint?.DisplayName is null)
        {
            await next(context);
            return;
        }

        var estateDetails = estateId is not null 
            ? new[] { new EstateDetails(estateId) }
            : null;

        var user = new UserDetails(
            context.User.GetObjectId(),
            context.User.GetName(),
            context.User.GetRoles());

        var request = new RequestDetails(
            context.TraceIdentifier,
            endpoint?.DisplayName ?? string.Empty,
            context.Request.QueryString.ToString(),
            requestBody);

        if (estateDetails is not { Length: > 0 } 
            && context.Request is { Method: "POST", Body.Length: > 0 })
        {
            estateDetails = await CallNextAndTryGetEstatesFromResponse(context);
        }
        else
        {
            await next(context);
        }

        var response = new ResponseDetails(context.Response.StatusCode);

        var responseLogRecord = new AuditLogRecord(
            user,
            request,
            response,
            estateDetails);

        await auditLogger.LogAsync(responseLogRecord);
    }

    private async Task<EstateDetails[]?> CallNextAndTryGetEstatesFromResponse(HttpContext context)
    {
        var originalResponseBody = context.Response.Body;
        using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        await next(context);

        EstateDetails[]? estateDetails = null;

        if (context.Response is { StatusCode: >= 200 and < 300 })
        {
            var response = await GetResponseBody(context.Response);
            var partialSearchResponse = JsonSerializer.Deserialize<PartialSearchResponse>(
                response, 
                JsonSerializerOptions.Web);

            estateDetails = partialSearchResponse?.Estates.Select(e => new EstateDetails(e.Id)).ToArray();
        }

        responseBody.Seek(0, SeekOrigin.Begin);
        await responseBody.CopyToAsync(originalResponseBody);
        context.Response.Body = originalResponseBody;

        return estateDetails;
    }


    private static async Task<string> GetRequestBody(HttpRequest request)
    {
        if (request.ContentType is null || !MediaTypeHeaderValue.TryParse(request.ContentType, out var mediaType))
        {
            return string.Empty;
        }

        if (!mediaType.MediaType.Equals("application/json", StringComparison.OrdinalIgnoreCase) &&
            !mediaType.SubType.Equals("json", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        request.EnableBuffering();
        request.Body.Position = 0;

        using var reader = new StreamReader(
            request.Body, 
            encoding: Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 1024,
            leaveOpen: true);

        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        return body;
    }

    private static async Task<string> GetResponseBody(HttpResponse response)
    {
        if (response.ContentType is null || !MediaTypeHeaderValue.TryParse(response.ContentType, out var mediaType))
        {
            return string.Empty;
        }

        if (!mediaType.MediaType.Equals("application/json", StringComparison.OrdinalIgnoreCase) &&
            !mediaType.SubType.Equals("json", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        response.Body.Position = 0;

        using var reader = new StreamReader(
            response.Body,
            encoding: Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 1024,
            leaveOpen: true);

        var body = await reader.ReadToEndAsync();
        response.Body.Position = 0;

        return body;
    }
}
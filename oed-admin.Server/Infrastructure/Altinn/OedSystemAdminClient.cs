using System.Net.Http.Json;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.Altinn;

/// <summary>
/// Client for the oed app's admin API (Maskinporten scope digdir:dd:systemadmin).
/// See the consumer guide in the oed repo: docs/migrate-declaration-consumer-guide.md
/// </summary>
public interface IOedSystemAdminClient
{
    Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(
        Guid estateId,
        bool overwrite,
        CancellationToken cancellationToken);
}

/// <param name="HttpStatus">The HTTP status, or 0 when the call never produced a response.</param>
/// <param name="Outcome">"Copied" or "Overwritten" on 200, otherwise null.</param>
/// <param name="Reason">The ProblemDetails "reason" extension member, or "StorageError" for a transport failure.</param>
public record MigrateDeclarationPdfResult(int HttpStatus, string? Outcome, string? Reason, string? Detail);

public class OedSystemAdminClient(HttpClient httpClient, ILogger<OedSystemAdminClient> logger) : IOedSystemAdminClient
{
    private const string MigrateDeclarationPdfPath = $"/{AppIds.Oed}/api/admin/migrate-declaration";

    public async Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(
        Guid estateId,
        bool overwrite,
        CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            // Deliberately no EnsureSuccessStatusCode: the failure bodies are the contract.
            response = await httpClient.PostAsJsonAsync(
                MigrateDeclarationPdfPath,
                new { estateId, overwrite },
                cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // A client-side timeout surfaces as TaskCanceledException with our own token uncancelled.
            // The consumer guide says to treat it like StorageError.
            return new MigrateDeclarationPdfResult(0, null, "StorageError", ex.Message);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                var success = await ReadOrNull<MigrateDeclarationPdfSuccessBody>(response, cancellationToken);
                return new MigrateDeclarationPdfResult((int)response.StatusCode, success?.Outcome, null, null);
            }

            var problem = await ReadOrNull<MigrateDeclarationPdfProblemBody>(response, cancellationToken);
            return new MigrateDeclarationPdfResult(
                (int)response.StatusCode,
                null,
                problem?.Reason,
                problem?.Detail ?? problem?.Title);
        }
    }

    private async Task<T?> ReadOrNull<T>(HttpResponseMessage response, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken);
        }
        catch (Exception ex) when (ex is JsonException or NotSupportedException)
        {
            // 401/403 have no body of our shape, and an unexpected body must not take the run down.
            logger.LogDebug(ex, "Unable to parse a {StatusCode} response from the oed admin API", (int)response.StatusCode);
            return null;
        }
    }

    // Parsed tolerantly: new fields may be added to either shape.
    private sealed record MigrateDeclarationPdfSuccessBody
    {
        public string? Outcome { get; init; }
        public string? OedInstanceId { get; init; }
        public string? DeclarationInstanceId { get; init; }
        public string? DataElementId { get; init; }
    }

    private sealed record MigrateDeclarationPdfProblemBody
    {
        public string? Title { get; init; }
        public int? Status { get; init; }
        public string? Detail { get; init; }
        public string? Reason { get; init; }
    }
}

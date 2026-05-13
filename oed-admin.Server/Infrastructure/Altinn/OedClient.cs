namespace oed_admin.Server.Infrastructure.Altinn;

public interface IOedClient
{
    public Task<object?> GetOedProbateInformation(int instanceOwnerPartyId, Guid instanceGuid);
    public Task<object?> GetOedProbateInformationV2(int instanceOwnerPartyId, Guid instanceGuid);
}

public class OedClient(HttpClient httpClient) : IOedClient
{
    public async Task<object?> GetOedProbateInformation(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"/{AppIds.Oed}/api/declarations/{instanceOwnerPartyId}/{instanceGuid}";
        return await GetObjectFromPath(path);
    }

    public async Task<object?> GetOedProbateInformationV2(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"/{AppIds.Oed}/api/v2/declarations/{instanceOwnerPartyId}/{instanceGuid}";
        return await GetObjectFromPath(path);
    }

    private async Task<object?> GetObjectFromPath(string path)
    {
        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadFromJsonAsync<object>();

        return contentString;
    }
}

public interface IOedAuthzClient
{
    public Task<object?> SearchRoles(string estateSsn, string? recipientSsn = null);
}

public class OedAuthzClient(HttpClient httpClient) : IOedAuthzClient
{
    public async Task<object?> SearchRoles(string estateSsn, string? recipientSsn = null)
    {
        var path = $"/api/v1/authorization/roles/search";

        var response = await httpClient.PostAsJsonAsync(path, new { estateSsn });

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadFromJsonAsync<object>();

        return contentString;
    }
}

public interface IOedEventsClient
{
    public Task SyncDaCase(Guid caseId);
}

public class OedEventsClient(HttpClient httpClient) : IOedEventsClient
{
    public async Task SyncDaCase(Guid caseId)
    {
        var path = $"/{AppIds.OedEvents}/da-events/api/v1/sync";
        var response = await httpClient.PostAsJsonAsync(path, new { caseId });

        response.EnsureSuccessStatusCode();
    }
}
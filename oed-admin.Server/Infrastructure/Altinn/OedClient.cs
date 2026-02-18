namespace oed_admin.Server.Infrastructure.Altinn;

public interface IOedClient
{
    public Task<object?> GetOedProbateInformation(int instanceOwnerPartyId, Guid instanceGuid);
}

public class OedClient(HttpClient httpClient) : IOedClient
{
    public async Task<object?> GetOedProbateInformation(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"/{AppIds.Oed}/api/declarations/{instanceOwnerPartyId}/{instanceGuid}";

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
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
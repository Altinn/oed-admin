using Altinn.Platform.Storage.Interface.Models;
using oed_testdata.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Infrastructure.Altinn;

public interface IAltinnClient
{
    public Task<string> GetEvents(string resource, string subject, string? after = "0");
    public Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid);
    public Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
}

public class AltinnClient(HttpClient httpClient) : IAltinnClient
{
    public async Task<string> GetEvents(string resource, string subject, string? after = "0")
    {
        var path = $"/events/api/v1/events?resource={resource}&subject={subject}&after={after}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;
    }

    public async Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"/storage/api/v1/instances/{instanceOwnerPartyId}/{instanceGuid}";
        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var instance = await AltinnJsonSerializer.Deserialize<Instance>(contentStream);

        return instance;
    }

    public async Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        var path = $"/storage/api/v1/instances/{instanceOwnerPartyId}/{instanceGuid}/data/{dataGuid}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;
    }
}

public static class EventResources
{
    public const string DodsboDomstoladminApi = "urn:altinn:resource:dodsbo-domstoladmin-api";
}
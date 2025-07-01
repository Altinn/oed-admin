using Altinn.Platform.Storage.Interface.Models;
using oed_testdata.Server.Infrastructure.Altinn;
using System.ClientModel;

namespace oed_admin.Server.Infrastructure.Altinn;

public interface IAltinnClient
{
    public Task<string> GetEvents(string resource, string subject, string? after = "0");
    public Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid);
    public Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
    public Task<TData> GetInstanceData<TData>(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
    public Task<InstanceSearchResponse> GetInstances(string appId, int count = 100, string? continuationToken = null);
    public Task<List<Instance>> GetInstances(string appId, int instanceOwnerPartyId);
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

    public async Task<TData> GetInstanceData<TData>(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        var path = $"/storage/api/v1/instances/{instanceOwnerPartyId}/{instanceGuid}/data/{dataGuid}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var data = AltinnXmlSerializer.Deserialize<TData>(contentStream);
        
        return data;
    }

    public async Task<InstanceSearchResponse> GetInstances(string appId, int count = 100, string? continuationToken = null)
    {
        // digdir/oed
        // digdir/declaration

        var path = $"/storage/api/v1/instances?org=digdir&appId={appId}&status.isHardDeleted=false&status.isSoftDeleted=false&size={count}";

        if (continuationToken is { Length: > 0 })
            path += $"&continuationToken={continuationToken}";
        
        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var searchResponse = await AltinnJsonSerializer.Deserialize<InstanceSearchResponse>(contentStream);

        return searchResponse;
    }

    public async Task<List<Instance>> GetInstances(string appId, int instanceOwnerPartyId)
    {
        var path = $"/storage/api/v1/instances?org=digdir&appId={appId}&instanceOwner.partyId={instanceOwnerPartyId}&status.isHardDeleted=false&status.isSoftDeleted=false";

        var response = await httpClient.GetAsync(path);
        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var searchResponse = await AltinnJsonSerializer.Deserialize<InstanceSearchResponse>(contentStream);

        return searchResponse.Instances;
    }

    //https://{{PlatformHostUrl}}/storage/api/v1/instances?org=digdir&appId=digdir/{{app}}&status.isHardDeleted=false&status.isSoftDeleted=false&size=10
}

public static class EventResources
{
    public const string DodsboDomstoladminApi = "urn:altinn:resource:dodsbo-domstoladmin-api";
}

public static class AppIds
{
    public const string Oed = "digdir/oed";
    public const string Declaration = "digdir/oed-declaration";
}


public class InstanceSearchResponse
{
    public int Count { get; init; }
    public string Self { get; init; } = string.Empty;
    public string Next { get; init; } = string.Empty;
    public List<Instance> Instances { get; init; } = [];
}
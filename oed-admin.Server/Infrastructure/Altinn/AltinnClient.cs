using Altinn.Platform.Storage.Interface.Models;
using CloudNative.CloudEvents;
using CloudNative.CloudEvents.SystemTextJson;
using Microsoft.Extensions.Options;
using oed_testdata.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Infrastructure.Altinn;

public interface IAltinnClient
{
    public Task<string> GetEventSubscriptions();
    public Task<string> DeleteEventSubscription(int id);
    public Task<IReadOnlyCollection<CloudEvent>> GetEvents(string resource, string subject, string? after = "0");
    public Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid);
    public Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
    public Task<InstanceDataContent> GetInstanceDataAsBytes(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
    public Task<TData> GetInstanceData<TData>(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
    public Task<InstanceSearchResponse> GetInstances(string appId, int count, string? continuationToken);
    public Task<List<Instance>> GetInstances(string appId, int instanceOwnerPartyId);

    public Task<object?> GetOedSigneeStatus(int instanceOwnerPartyId, Guid instanceGuid);

    public Task<object?> GetHeirDeclaration(int instanceOwnerPartyId, Guid instanceGuid, string subApp, int heirPartyId,
        Guid heirInstanceId);
}

public class AltinnClient(HttpClient httpClient, IOptionsMonitor<AltinnSettings> altinnSettingsOptionsMonitor) : IAltinnClient
{
    public async Task<string> GetEventSubscriptions()
    {
        var path = $"/events/api/v1/subscriptions";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;
    }

    public async Task<string> DeleteEventSubscription(int id)
    {
        var path = $"/events/api/v1/subscriptions/{id}";

        var response = await httpClient.DeleteAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;

    }

    public async Task<IReadOnlyCollection<CloudEvent>> GetEvents(string resource, string subject, string? after = "0")
    {
        var path = $"/events/api/v1/events?resource={resource}&subject={subject}&size=500&after={after}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        var formatter = new JsonEventFormatter();
        var contentType = new System.Net.Mime.ContentType("application/cloudevents+json");
        return await formatter.DecodeBatchModeMessageAsync(await response.Content.ReadAsStreamAsync(), contentType, null);
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

    public async Task<InstanceDataContent> GetInstanceDataAsBytes(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        var path = $"/storage/api/v1/instances/{instanceOwnerPartyId}/{instanceGuid}/data/{dataGuid}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        var content = await response.Content.ReadAsByteArrayAsync();

        return new InstanceDataContent(content, contentType);
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

    public async Task<InstanceSearchResponse> GetInstances(string appId, int count, string? continuationToken)
    {
        // digdir/oed
        // digdir/declaration

        var path = $"/storage/api/v1/instances?org=digdir&appId={appId}&size={count}";

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
        var path = $"/storage/api/v1/instances?org=digdir&appId={appId}&instanceOwner.partyId={instanceOwnerPartyId}";

        var response = await httpClient.GetAsync(path);
        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var searchResponse = await AltinnJsonSerializer.Deserialize<InstanceSearchResponse>(contentStream);

        return searchResponse.Instances;
    }

    public async Task<object?> GetOedSigneeStatus(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"{altinnSettingsOptionsMonitor.CurrentValue.AppsUrl}/{AppIds.Oed}/api/app/{instanceOwnerPartyId}/{instanceGuid}/subapps";
        return await GetObjectFromPath(path);
    }

    // NOTE: This method lives on AltinnClient only because the OED endpoint it targets is
    // temporarily secured with the authorization this client is configured for. Once the OED
    // endpoint's authorization is changed back to the correct one, move this method to OedClient.
    public async Task<object?> GetHeirDeclaration(int instanceOwnerPartyId, Guid instanceGuid, string subApp, int heirPartyId, Guid heirInstanceId)
    {
        var path = $"{altinnSettingsOptionsMonitor.CurrentValue.AppsUrl}/{AppIds.Oed}/api/app/{instanceOwnerPartyId}/{instanceGuid}/subapps/{subApp}/{heirPartyId}/{heirInstanceId}/declaration";
        return await GetObjectFromPath(path);
    }

    private async Task<object?> GetObjectFromPath(string path)
    {
        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadFromJsonAsync<object>();

        return contentString;
    }
    //https://{{PlatformHostUrl}}/storage/api/v1/instances?org=digdir&appId=digdir/{{app}}&status.isHardDeleted=false&status.isSoftDeleted=false&size=10
}

public static class EventResources
{
    public const string DodsboDomstoladminApi = "urn:altinn:resource:dodsbo-domstoladmin-api";
    public const string Declaration = "urn:altinn:resource:app_digdir_oed-declaration";
}

public static class AppIds
{
    public const string Oed = "digdir/oed";
    public const string OedEvents = "digdir/oed-events";
    public const string Declaration = "digdir/oed-declaration";
}


public class InstanceSearchResponse
{
    public int Count { get; init; }
    public string Self { get; init; } = string.Empty;
    public string Next { get; init; } = string.Empty;
    public List<Instance> Instances { get; init; } = [];
}

public record InstanceDataContent(byte[] Content, string ContentType);
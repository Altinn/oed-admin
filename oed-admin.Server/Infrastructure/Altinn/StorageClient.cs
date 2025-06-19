using Altinn.Platform.Storage.Interface.Models;
using oed_testdata.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Infrastructure.Altinn;

public interface IStorageClient
{
    public Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid);
    public Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid);
}

public class StorageClient(HttpClient httpClient) : IStorageClient
{
    private const string BasePath = "/storage/api/v1";

    public async Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid)
    {
        var path = $"{BasePath}/instances/{instanceOwnerPartyId}/{instanceGuid}";
        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();

        await using var contentStream = await response.Content.ReadAsStreamAsync();
        var instance = await AltinnJsonSerializer.Deserialize<Instance>(contentStream);

        return instance;
    }

    public async Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        var path = $"{BasePath}/instances/{instanceOwnerPartyId}/{instanceGuid}/data/{dataGuid}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;
    }

}
using System.Net;
using System.Text.Json;
using Altinn.Platform.Storage.Interface.Models;
using CloudNative.CloudEvents;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Tests;

/// <summary>An in-memory Platform Storage. Counts the calls, so a test can prove Storage was never asked.</summary>
public sealed class FakeAltinnClient : IAltinnClient
{
    public Dictionary<(int PartyId, Guid InstanceGuid), Instance> Instances { get; } = [];
    public Dictionary<Guid, object> Data { get; } = [];
    public Dictionary<Guid, InstanceDataContent> Bytes { get; } = [];
    public HttpStatusCode? FailWith { get; set; }
    public Exception? ThrowOnGetInstanceData { get; set; }

    public int GetInstanceCalls { get; private set; }
    public int GetInstanceDataCalls { get; private set; }
    public int GetInstanceDataAsBytesCalls { get; private set; }
    public List<Guid> RequestedDataGuids { get; } = [];

    /// <summary>Adds an oed instance with the given data elements; <paramref name="data"/> is stored per element id.</summary>
    public Instance AddInstance(int partyId, Guid instanceGuid, params (string DataType, string ContentType, object? Data)[] elements)
    {
        var instance = new Instance
        {
            Id = $"{partyId}/{instanceGuid}",
            InstanceOwner = new InstanceOwner { PartyId = partyId.ToString() },
            Data = [],
        };

        foreach (var (dataType, contentType, data) in elements)
        {
            var dataGuid = Guid.NewGuid();
            instance.Data.Add(new DataElement
            {
                Id = dataGuid.ToString(),
                InstanceGuid = instanceGuid.ToString(),
                DataType = dataType,
                ContentType = contentType,
            });
            if (data is not null)
                Data[dataGuid] = data;
        }

        Instances[(partyId, instanceGuid)] = instance;
        return instance;
    }

    public Task<Instance?> GetInstance(int instanceOwnerPartyId, Guid instanceGuid)
    {
        GetInstanceCalls++;
        ThrowIfFailing();
        return Task.FromResult(Instances.GetValueOrDefault((instanceOwnerPartyId, instanceGuid)));
    }

    public Task<TData> GetInstanceData<TData>(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        GetInstanceDataCalls++;
        RequestedDataGuids.Add(dataGuid);
        ThrowIfFailing();
        if (ThrowOnGetInstanceData is { } ex)
            throw ex;
        return Data.TryGetValue(dataGuid, out var data)
            ? Task.FromResult((TData)data)
            : throw new HttpRequestException("Not found", null, HttpStatusCode.NotFound);
    }

    public Task<InstanceDataContent> GetInstanceDataAsBytes(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        GetInstanceDataAsBytesCalls++;
        RequestedDataGuids.Add(dataGuid);
        ThrowIfFailing();
        return Task.FromResult(Bytes.TryGetValue(dataGuid, out var content)
            ? content
            : new InstanceDataContent([1, 2, 3], "application/pdf"));
    }

    private void ThrowIfFailing()
    {
        if (FailWith is { } status)
            throw new HttpRequestException($"HTTP {(int)status}", null, status);
    }

    public Task<string> GetEventSubscriptions() => throw new NotSupportedException();
    public Task<string> DeleteEventSubscription(int id) => throw new NotSupportedException();
    public Task<IReadOnlyCollection<CloudEvent>> GetEvents(string resource, string subject, string? after = "0") => throw new NotSupportedException();
    public Task<string> GetInstanceDataAsString(int instanceOwnerPartyId, Guid instanceGuid, Guid dataGuid)
    {
        GetInstanceDataCalls++;
        RequestedDataGuids.Add(dataGuid);
        ThrowIfFailing();
        return Task.FromResult($"<oed>{dataGuid}</oed>");
    }
    public Task<InstanceSearchResponse> GetInstances(string appId, int count, string? continuationToken) => throw new NotSupportedException();
    public Task<List<Instance>> GetInstances(string appId, int instanceOwnerPartyId) => throw new NotSupportedException();
    public Task<object?> GetOedSigneeStatus(int instanceOwnerPartyId, Guid instanceGuid) => throw new NotSupportedException();
}

/// <summary>Small OED_M documents for tests, and their stored JSON.</summary>
public static class TestModels
{
    public const string OedXml = "application/xml";

    public static OedInstanceData Model(string caseNumber, params HeirInfo[] heirs) => new()
    {
        CaseNumber = caseNumber,
        Heirs = [.. heirs],
    };

    public static HeirInfo Heir(string role, string birthday, string? courtRole = "urn:domstolene:digitaltdodsbo:formuesfullmakt") =>
        new() { HeirV2 = new PersonHeirV2 { Role = role, Birthday = birthday, CourtRole = courtRole! } };

    /// <summary>The model as oed stores it.</summary>
    public static string Json(OedInstanceData model) => JsonSerializer.Serialize(model, OedModelJson.Options);
}

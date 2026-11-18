using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.OedModel;
using static oed_admin.Server.Tests.TestModels;

namespace oed_admin.Server.Tests.OedModel;

[Collection(PostgresCollection.Name)]
public class OedModelSourceTests(PostgresFixture fixture)
{
    private readonly FakeAltinnClient _storage = new();
    private readonly Guid _instanceGuid = Guid.NewGuid();
    private const int PartyId = 50100;

    private async Task<OedModelResult> Get(int partyId = PartyId)
    {
        await using var dbContext = fixture.CreateDbContext();
        var source = new OedModelSource(dbContext, _storage, NullLogger<OedModelSource>.Instance);
        return await source.Get(partyId, _instanceGuid);
    }

    [Fact]
    public async Task Get_RowAndStorageBothExist_ReturnsRowAndNeverCallsStorage()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("FROM-ROW")));
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("FROM-STORAGE")));

        var result = await Get();

        Assert.Equal(OedModelOrigin.Database, result.Origin);
        Assert.Equal("FROM-ROW", result.Model!.CaseNumber);
        Assert.Equal(0, _storage.GetInstanceCalls);
        Assert.Equal(0, _storage.GetInstanceDataCalls);
    }

    [Fact]
    public async Task Get_RowFromJsonb_KeepsHeirSubtypes()
    {
        var snapshot = await File.ReadAllTextAsync(Path.Combine("TestData", "oed_model_storage_contract.json"));
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, snapshot);

        var result = await Get();

        Assert.Equal(
            [typeof(PersonHeirV2), typeof(PersonHeir), typeof(OrganizationHeir), typeof(PappPersonHeir), typeof(PappOrganizationHeir), null],
            result.Model!.Heirs.Select(h => h.HeirV2?.GetType()));
    }

    [Fact]
    public async Task Get_NoRow_ReadsStorage()
    {
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("FROM-STORAGE")));

        var result = await Get();

        Assert.Equal(OedModelOrigin.Storage, result.Origin);
        Assert.Equal("FROM-STORAGE", result.Model!.CaseNumber);
    }

    [Fact]
    public async Task Get_NoRow_ReadsOedElementByDataTypeNotPosition()
    {
        var instance = _storage.AddInstance(PartyId, _instanceGuid,
            ("dataTypeChecklists", OedXml, null),
            ("oed", OedXml, Model("FROM-STORAGE")));

        var result = await Get();

        Assert.Equal("FROM-STORAGE", result.Model!.CaseNumber);
        Assert.Equal([Guid.Parse(instance.Data[1].Id)], _storage.RequestedDataGuids);
    }

    [Fact]
    public async Task Get_NoRowNoInstance_ReturnsNoInstance()
    {
        var result = await Get();

        Assert.Null(result.Model);
        Assert.Equal(OedModelMissing.NoInstance, result.Missing);
    }

    [Fact]
    public async Task Get_NoRowNoOedElement_ReturnsNoDataElement()
    {
        _storage.AddInstance(PartyId, _instanceGuid, ("ref-data-as-pdf", "application/pdf", null));

        var result = await Get();

        Assert.Null(result.Model);
        Assert.Equal(OedModelMissing.NoDataElement, result.Missing);
        Assert.Equal(0, _storage.GetInstanceDataCalls);
    }

    [Fact]
    public async Task Get_RowOfOtherParty_ReturnsPartyMismatchWithoutStorage()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("FROM-ROW")));
        _storage.AddInstance(PartyId + 1, _instanceGuid, ("oed", OedXml, Model("FROM-STORAGE")));

        var result = await Get(PartyId + 1);

        Assert.Null(result.Model);
        Assert.Equal(OedModelMissing.PartyMismatch, result.Missing);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }

    [Fact]
    public async Task Get_RowWithInvalidJson_ThrowsAndDoesNotReadStorage()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, """{"heirs":[{"heirV2":{"type":"Nope"}}]}""");
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("FROM-STORAGE")));

        var ex = await Assert.ThrowsAsync<OedModelUnreadableException>(() => Get());
        Assert.IsAssignableFrom<JsonException>(ex.InnerException);
        Assert.Equal(OedModelOrigin.Database, ex.Origin);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }

    [Fact]
    public async Task Get_NoRowStorageXmlUnreadable_ThrowsUnreadable()
    {
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("FROM-STORAGE")));
        // How XmlSerializer reports any parse error.
        _storage.ThrowOnGetInstanceData = new InvalidOperationException("There is an error in XML document (1, 1).");

        var ex = await Assert.ThrowsAsync<OedModelUnreadableException>(() => Get());

        Assert.Equal(OedModelOrigin.Storage, ex.Origin);
    }
}

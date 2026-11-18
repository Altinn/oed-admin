using Microsoft.AspNetCore.Http.HttpResults;
using oed_admin.Server.Features.Estate.GetInstance;
using static oed_admin.Server.Tests.TestModels;

namespace oed_admin.Server.Tests.Features;

/// <summary>The estate detail page's "Oed instans": its model must come from the row once the estate has one.</summary>
[Collection(PostgresCollection.Name)]
public class EstateGetInstanceTests(PostgresFixture fixture)
{
    private readonly FakeAltinnClient _storage = new();
    private readonly Guid _instanceGuid = Guid.NewGuid();
    private const int PartyId = 50500;

    private async Task<Response> Get(Guid estateId)
    {
        await using var dbContext = fixture.CreateDbContext();
        var result = await Endpoint.Get(new Request(estateId), dbContext, _storage);
        return Assert.IsType<Ok<Response>>(result).Value!;
    }

    [Fact]
    public async Task Get_EstateWithRow_ReturnsRowModelAndNoStorageData()
    {
        var estateId = await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("FROM-ROW")));
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, null));

        var response = await Get(estateId);

        Assert.Contains("FROM-ROW", response.Model);
        Assert.Null(response.InstanceData);
        Assert.NotNull(response.Instance);
        Assert.Equal(0, _storage.GetInstanceDataCalls);
    }

    [Fact]
    public async Task Get_EstateWithRowOfOtherParty_ReturnsNoModelAndNoStorageData()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("FROM-ROW")));
        var estateId = await fixture.InsertEstate(Guid.NewGuid(), PartyId);
        // Point a second estate at the same instance guid under another party.
        await using (var dbContext = fixture.CreateDbContext())
        {
            var estate = await dbContext.Estate.FindAsync(estateId);
            estate!.InstanceId = $"{PartyId + 1}/{_instanceGuid}";
            await dbContext.SaveChangesAsync();
        }
        _storage.AddInstance(PartyId + 1, _instanceGuid, ("oed", OedXml, null));

        var response = await Get(estateId);

        Assert.Null(response.Model);
        Assert.Null(response.InstanceData);
        Assert.Equal(0, _storage.GetInstanceDataCalls);
    }

    [Fact]
    public async Task Get_EstateWithoutRow_ReturnsOedElementNotFirstElement()
    {
        var estateId = await fixture.InsertEstate(_instanceGuid, PartyId);
        var instance = _storage.AddInstance(PartyId, _instanceGuid,
            ("dataTypeChecklists", OedXml, null),
            ("oed", OedXml, null));

        var response = await Get(estateId);

        Assert.Null(response.Model);
        Assert.Equal($"<oed>{Guid.Parse(instance.Data[1].Id)}</oed>", response.InstanceData);
    }
}

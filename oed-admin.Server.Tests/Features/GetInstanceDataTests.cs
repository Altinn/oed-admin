using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using oed_admin.Server.Features.Instances.GetInstanceData;
using Endpoint = oed_admin.Server.Features.Instances.GetInstanceData.Endpoint;
using static oed_admin.Server.Tests.TestModels;

namespace oed_admin.Server.Tests.Features;

[Collection(PostgresCollection.Name)]
public class GetInstanceDataTests(PostgresFixture fixture)
{
    private readonly FakeAltinnClient _storage = new();
    private readonly Guid _instanceGuid = Guid.NewGuid();
    private const int PartyId = 50400;

    private async Task<IResult> Get(string dataId)
    {
        await using var dbContext = fixture.CreateDbContext();
        return await Endpoint.Get(new Request(PartyId, _instanceGuid, Guid.Parse(dataId)), dbContext, _storage);
    }

    [Fact]
    public async Task Get_OedElementOfInstanceWithRow_Returns404WithoutReadingData()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("ROW")));
        var instance = _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, null));

        var result = await Get(instance.Data[0].Id);

        Assert.IsType<NotFound>(result);
        Assert.Equal(0, _storage.GetInstanceDataAsBytesCalls);
    }

    [Fact]
    public async Task Get_OtherElementOfInstanceWithRow_ReturnsFile()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("ROW")));
        var instance = _storage.AddInstance(PartyId, _instanceGuid,
            ("oed", OedXml, null),
            ("declaration-pdf", "application/pdf", null));

        var result = await Get(instance.Data[1].Id);

        Assert.IsType<FileContentHttpResult>(result);
        Assert.Equal(1, _storage.GetInstanceDataAsBytesCalls);
    }

    [Fact]
    public async Task Get_InstanceWithoutRow_ReturnsFileWithoutGetInstance()
    {
        // A sub-app receipt, the proxy's everyday use: no estate_model row for that instance.
        var result = await Get(Guid.NewGuid().ToString());

        Assert.IsType<FileContentHttpResult>(result);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }
}

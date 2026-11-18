using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using oed_admin.Server.Features.Estate.MinimalSearch;
using oed_admin.Server.Infrastructure.OedModel;
using static oed_admin.Server.Tests.TestModels;

namespace oed_admin.Server.Tests.Features;

[Collection(PostgresCollection.Name)]
public class MinimalSearchTests(PostgresFixture fixture)
{
    private readonly FakeAltinnClient _storage = new();
    // A nin per test, so tests sharing the database don't see each other's estates.
    private readonly string _nin = Random.Shared.NextInt64(10_000_000_000, 99_999_999_999).ToString();
    private const int PartyId = 50200;

    private async Task<Response> Search()
    {
        await using var dbContext = fixture.CreateDbContext();
        var source = new OedModelSource(dbContext, _storage, NullLogger<OedModelSource>.Instance);
        var result = await Endpoint.Post(new Request(_nin), dbContext, source);
        return Assert.IsType<Ok<Response>>(result).Value;
    }

    [Fact]
    public async Task Post_EstateWithRow_HeirsComeFromRow()
    {
        var instanceGuid = Guid.NewGuid();
        await fixture.InsertEstateWithModel(instanceGuid, PartyId,
            Json(Model("ROW", Heir("barn", "1980-02-03"), Heir("barn", "1990-01-01", courtRole: null))),
            deceasedNin: _nin);
        _storage.AddInstance(PartyId, instanceGuid, ("oed", OedXml, Model("STORAGE", Heir("barn", "1111-11-11"))));

        var response = await Search();

        Assert.Equal([new MinimalPerson("1980-02-03")], response.Estate.Heirs);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }

    [Fact]
    public async Task Post_EstateWithoutRow_HeirsComeFromStorageOedElement()
    {
        var instanceGuid = Guid.NewGuid();
        await fixture.InsertEstate(instanceGuid, PartyId, deceasedNin: _nin);
        _storage.AddInstance(PartyId, instanceGuid,
            ("dataTypeChecklists", OedXml, null),
            ("oed", OedXml, Model("STORAGE", Heir("barn", "1975-05-06"))));

        var response = await Search();

        Assert.Equal([new MinimalPerson("1975-05-06")], response.Estate.Heirs);
    }

    [Fact]
    public async Task Post_TwoEstatesSameNin_UsesNewestByCreated()
    {
        var older = Guid.NewGuid();
        var newer = Guid.NewGuid();
        await fixture.InsertEstateWithModel(older, PartyId, Json(Model("OLD", Heir("barn", "1960-01-01"))),
            deceasedNin: _nin, created: DateTimeOffset.UtcNow.AddDays(-2));
        await fixture.InsertEstateWithModel(newer, PartyId, Json(Model("NEW", Heir("barn", "1970-01-01"))),
            deceasedNin: _nin, created: DateTimeOffset.UtcNow.AddDays(-1));

        var response = await Search();

        Assert.Equal([new MinimalPerson("1970-01-01")], response.Estate.Heirs);
    }

    [Fact]
    public async Task Post_NoInstanceAndNoRow_ReturnsEmptyResponse()
    {
        await fixture.InsertEstate(Guid.NewGuid(), PartyId, deceasedNin: _nin);

        var response = await Search();

        Assert.Null(response.Estate);
    }
}

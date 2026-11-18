using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using oed_admin.Server.Infrastructure.EstateCount;
using oed_admin.Server.Infrastructure.OedModel;
using static oed_admin.Server.Tests.TestModels;

namespace oed_admin.Server.Tests.EstateCount;

[Collection(PostgresCollection.Name)]
public class EstateCountCheckTests(PostgresFixture fixture)
{
    private readonly FakeAltinnClient _storage = new();
    private readonly Guid _instanceGuid = Guid.NewGuid();
    private const int PartyId = 50300;

    private async Task<EstateCountService.CheckResult> Check(int partyId = PartyId)
    {
        await using var dbContext = fixture.CreateDbContext();
        var source = new OedModelSource(dbContext, _storage, NullLogger<OedModelSource>.Instance);
        var row = new EstateCountService.EstateRow(Guid.NewGuid(), "CASE-1", $"{partyId}/{_instanceGuid}", DateTimeOffset.UtcNow);
        return await EstateCountService.CheckEstate(source, row, CancellationToken.None);
    }

    [Fact]
    public async Task CheckEstate_WithRow_RolesFromRowWithoutStorage()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId,
            Json(Model("ROW", Heir("barn", "1980-01-01"), Heir("testamentsarving", "1981-01-01"))));
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("STORAGE", Heir("ektefelle", "1950-01-01"))));

        var result = await Check();

        Assert.Null(result.FailureReason);
        Assert.Equal(["barn", "testamentsarving"], result.HeirRoles);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }

    [Fact]
    public async Task CheckEstate_WithoutRow_RolesFromStorage()
    {
        _storage.AddInstance(PartyId, _instanceGuid, ("oed", OedXml, Model("STORAGE", Heir("ektefelle", "1950-01-01"))));

        var result = await Check();

        Assert.Equal(["ektefelle"], result.HeirRoles);
    }

    [Fact]
    public async Task CheckEstate_InvalidRowJson_IsInvalidData()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, """{"heirs":[{"heirV2":{"type":"Nope"}}]}""");

        var result = await Check();

        Assert.Equal("InvalidData", result.FailureReason);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }

    [Fact]
    public async Task CheckEstate_UnexpectedInvalidOperation_IsNotHiddenAsInvalidData()
    {
        // E.g. EF refusing a concurrently used context: a bug, which must fault the run, not count as bad data.
        var source = new ThrowingSource(new InvalidOperationException("A second operation was started on this context"));
        var row = new EstateCountService.EstateRow(Guid.NewGuid(), "CASE-1", $"{PartyId}/{_instanceGuid}", DateTimeOffset.UtcNow);

        await Assert.ThrowsAsync<InvalidOperationException>(() => EstateCountService.CheckEstate(source, row, CancellationToken.None));
    }

    [Fact]
    public void IsTransient_TransientNpgsqlException_IsTrue()
    {
        var ex = new NpgsqlException("Exception while reading from stream", new TimeoutException());

        Assert.True(EstateCountService.IsTransient(ex, CancellationToken.None));
    }

    [Fact]
    public void IsTransient_NonTransientNpgsqlException_IsFalse()
    {
        Assert.False(EstateCountService.IsTransient(new NpgsqlException("syntax error"), CancellationToken.None));
    }

    [Fact]
    public void ExhaustedFailure_DatabaseError_IsNotCalledStorageError()
    {
        var result = EstateCountService.ExhaustedFailure(new NpgsqlException("Exception while reading from stream", new TimeoutException()));

        Assert.Equal("DatabaseError", result.FailureReason);
    }

    [Fact]
    public void ExhaustedFailure_HttpError_IsStorageError()
    {
        var result = EstateCountService.ExhaustedFailure(new HttpRequestException("boom", null, System.Net.HttpStatusCode.BadGateway));

        Assert.Equal("StorageError", result.FailureReason);
        Assert.Equal("HTTP 502: boom", result.Detail);
    }

    private sealed class ThrowingSource(Exception ex) : IOedModelSource
    {
        public Task<OedModelResult> Get(int instanceOwnerPartyId, Guid instanceGuid, CancellationToken cancellationToken = default) =>
            Task.FromException<OedModelResult>(ex);
    }

    [Fact]
    public async Task CheckEstate_RowOfOtherParty_IsNoOedInstance()
    {
        await fixture.InsertEstateWithModel(_instanceGuid, PartyId, Json(Model("ROW", Heir("barn", "1980-01-01"))));

        var result = await Check(PartyId + 1);

        Assert.Equal("NoOedInstance", result.FailureReason);
        Assert.Equal("PartyMismatch", result.Detail);
        Assert.Equal(0, _storage.GetInstanceCalls);
    }
}

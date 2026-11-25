using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Tests.OedModelAdmin;

/// <summary>
/// The OED_M admin calls in <see cref="OedSystemAdminClient"/> against oed's answers (Altinn/oed#1923 §6).
/// <c>TestData/OedModelAdmin/*.json</c> are copies of oed's snapshots
/// <c>ApiTest/ContractSnapshots/oed_model_{phase_get,phase_put,copy}_contract.json</c> (digdir/oed, commit 54cddc92,
/// release 1362), which pin the wire shape. When oed changes one, copy it here again and run these tests.
/// </summary>
public class OedModelAdminClientTests
{
    private readonly StubHandler _handler = new();
    private readonly OedSystemAdminClient _client;

    public OedModelAdminClientTests()
    {
        _client = new OedSystemAdminClient(
            new HttpClient(_handler) { BaseAddress = new Uri("https://digdir.apps.tt02.altinn.no") },
            NullLogger<OedSystemAdminClient>.Instance);
    }

    private static string Snapshot(string name) =>
        File.ReadAllText(Path.Combine("TestData", "OedModelAdmin", $"oed_model_{name}_contract.json"));

    private static string CopySnapshotWith(string outcome, string? failure = null, string? failureReason = null)
    {
        var body = JsonNode.Parse(Snapshot("copy"))!.AsObject();
        body["outcome"] = outcome;
        body["failure"] = failure;
        body["failureReason"] = failureReason;
        return body.ToJsonString();
    }

    private static string Problem(int status, string title, string? detail = null) =>
        new JsonObject { ["title"] = title, ["status"] = status, ["detail"] = detail }.ToJsonString();

    [Fact]
    public async Task GetPhase_200_ReadsEveryField()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("phase_get"));

        var result = await _client.GetOedModelPhase(CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        Assert.Null(result.Problem);
        Assert.Equal(
            new OedModelPhaseState("Migrating", "canary done", new DateTimeOffset(2026, 11, 16, 9, 0, 0, TimeSpan.Zero), "oed-admin-client", "Migrating"),
            result.Phase);
        Assert.Equal(HttpMethod.Get, _handler.Request!.Method);
        Assert.Equal("/digdir/oed/api/admin/oed-model/phase", _handler.Request.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task SetPhase_200_SendsPhaseAndReasonAndReadsTheAnswer()
    {
        // oed leaves "changed" out of its snapshot (it is the time of the request); put a real one back.
        var body = JsonNode.Parse(Snapshot("phase_put"))!.AsObject();
        body["changed"] = "2026-11-18T10:00:00+00:00";
        _handler.Respond(HttpStatusCode.OK, body.ToJsonString());

        var result = await _client.SetOedModelPhase("Storage", "pause", CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        Assert.Equal("Storage", result.Phase!.Phase);
        Assert.Equal("pause", result.Phase.Reason);
        Assert.Equal("Migrating", result.Phase.CachedOnThisPod);
        Assert.Equal(HttpMethod.Put, _handler.Request!.Method);
        Assert.Equal("/digdir/oed/api/admin/oed-model/phase", _handler.Request.RequestUri!.AbsolutePath);
        var sent = JsonNode.Parse(_handler.RequestBody!)!;
        Assert.Equal("Storage", sent["phase"]!.GetValue<string>());
        Assert.Equal("pause", sent["reason"]!.GetValue<string>());
    }

    [Fact]
    public async Task SetPhase_400_ReadsTheValidationErrors()
    {
        _handler.Respond(HttpStatusCode.BadRequest, """
            {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,
             "errors":{"reason":["reason is required"]}}
            """);

        var result = await _client.SetOedModelPhase("Storage", " ", CancellationToken.None);

        Assert.Equal(400, result.HttpStatus);
        Assert.Null(result.Phase);
        Assert.Equal(["reason is required"], result.Problem!.Errors!["reason"]);
    }

    [Fact]
    public async Task SetPhase_409_KeepsTheRefusalVerbatim()
    {
        _handler.Respond(HttpStatusCode.Conflict, Problem(409, "The phase can't be set to Database", "No verify run exists yet (#1902)"));

        var result = await _client.SetOedModelPhase("Database", "test", CancellationToken.None);

        Assert.Equal(409, result.HttpStatus);
        Assert.Null(result.Phase);
        Assert.Equal("No verify run exists yet (#1902)", result.Problem!.Detail);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task Phase_403WithoutBody_GivesTheStatusAndNoProblem()
    {
        _handler.Respond(HttpStatusCode.Forbidden, "");

        var result = await _client.GetOedModelPhase(CancellationToken.None);

        Assert.Equal(403, result.HttpStatus);
        Assert.Null(result.Phase);
        Assert.Null(result.Problem);
    }

    [Fact]
    public async Task Phase_TransportFailure_GivesStatus0()
    {
        _handler.Throw(new HttpRequestException("connection refused"));

        var result = await _client.SetOedModelPhase("Storage", "pause", CancellationToken.None);

        Assert.Equal(0, result.HttpStatus);
        Assert.Null(result.Phase);
        Assert.Equal("connection refused", result.Problem!.Detail);
    }

    [Fact]
    public async Task Copy_200_ReadsEveryField()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("copy"));
        var instanceGuid = Guid.NewGuid();

        var result = await _client.CopyOedModel(512345, instanceGuid, CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        Assert.Null(result.Problem);
        Assert.Null(result.RetryAfterSeconds);
        var copy = result.Copy!;
        Assert.Equal("Copied", copy.Outcome);
        Assert.Null(copy.Failure);
        Assert.Null(copy.FailureReason);
        Assert.Equal(["oed/Heirs/HeirInfo/Obsolete"], copy.DroppedElements);
        Assert.Equal(new DateTimeOffset(2026, 6, 7, 8, 9, 10, TimeSpan.Zero), copy.StorageLastChanged);
        Assert.Equal(new DateTimeOffset(2025, 1, 2, 1, 4, 5, TimeSpan.Zero), copy.Created);
        Assert.Equal(HttpMethod.Post, _handler.Request!.Method);
        Assert.Equal($"/digdir/oed/api/admin/oed-model/estates/512345/{instanceGuid}/copy", _handler.Request.RequestUri!.AbsolutePath);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK, "Failed", "RoundTrip", "/oed/Heirs[1] differs")]
    [InlineData(HttpStatusCode.OK, "NoOedElement", null, null)]
    [InlineData(HttpStatusCode.NotFound, "InstanceNotFound", null, null)]
    [InlineData(HttpStatusCode.Conflict, "NotAllowed", null, null)]
    [InlineData(HttpStatusCode.BadGateway, "Failed", "StorageError", "Storage answered 500")]
    public async Task Copy_TheBodyIsTheResultForEveryStatus(HttpStatusCode status, string outcome, string? failure, string? failureReason)
    {
        _handler.Respond(status, CopySnapshotWith(outcome, failure, failureReason));

        var result = await _client.CopyOedModel(512345, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal((int)status, result.HttpStatus);
        Assert.Equal(outcome, result.Copy!.Outcome);
        Assert.Equal(failure, result.Copy.Failure);
        Assert.Equal(failureReason, result.Copy.FailureReason);
        Assert.Null(result.Problem);
    }

    [Fact]
    public async Task Copy_503_GivesRetryAfterAndTheProblem()
    {
        _handler.Respond(
            HttpStatusCode.ServiceUnavailable,
            Problem(503, "The estate is busy", "The copy waited too long on another write to the same estate. Nothing was stored; try again."),
            response => response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(10)));

        var result = await _client.CopyOedModel(512345, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(503, result.HttpStatus);
        Assert.Null(result.Copy);
        Assert.Equal(10, result.RetryAfterSeconds);
        Assert.Equal("The estate is busy", result.Problem!.Title);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task Copy_TransportFailure_GivesStatus0()
    {
        _handler.Throw(new TaskCanceledException("timed out"));

        var result = await _client.CopyOedModel(512345, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(0, result.HttpStatus);
        Assert.Null(result.Copy);
        Assert.Equal("timed out", result.Problem!.Detail);
    }

    // oed_model_orphan_soft_delete_contract.json is a copy of oed's snapshot (digdir/oed, commit 962802d, Altinn/oed#1905).
    private static string OrphanSnapshotWith(string outcome, string? reason = null)
    {
        var body = JsonNode.Parse(Snapshot("orphan_soft_delete"))!.AsObject();
        body["outcome"] = outcome;
        body["reason"] = reason;
        return body.ToJsonString();
    }

    [Fact]
    public async Task SoftDeleteOrphan_200_ReadsEveryField()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("orphan_soft_delete"));
        var instanceGuid = Guid.NewGuid();

        var result = await _client.SoftDeleteOedModelOrphan(50005681, instanceGuid, CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        Assert.Null(result.Problem);
        Assert.Null(result.RetryAfterSeconds);
        var removal = result.Result!;
        Assert.Equal("SoftDeleted", removal.Outcome);
        Assert.Null(removal.Reason);
        Assert.Equal(new DateTimeOffset(2022, 3, 3, 9, 36, 41, TimeSpan.FromHours(1)), removal.Created);
        Assert.Equal(new DateTimeOffset(2023, 1, 18, 10, 10, 47, TimeSpan.FromHours(1)), removal.LastChanged);
        Assert.Equal(HttpMethod.Post, _handler.Request!.Method);
        Assert.Equal(
            $"/digdir/oed/api/admin/oed-model/estates/50005681/{instanceGuid}/soft-delete-orphan",
            _handler.Request.RequestUri!.AbsolutePath);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK, "AlreadyDeleted", null)]
    [InlineData(HttpStatusCode.OK, "NotAnOrphan", "hasModelRow")]
    [InlineData(HttpStatusCode.NotFound, "InstanceNotFound", null)]
    [InlineData(HttpStatusCode.Conflict, "NotAllowed", null)]
    [InlineData(HttpStatusCode.BadGateway, "StorageError", "PlatformHttpException")]
    public async Task SoftDeleteOrphan_TheBodyIsTheResultForEveryStatus(HttpStatusCode status, string outcome, string? reason)
    {
        _handler.Respond(status, OrphanSnapshotWith(outcome, reason));

        var result = await _client.SoftDeleteOedModelOrphan(50005681, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal((int)status, result.HttpStatus);
        Assert.Equal(outcome, result.Result!.Outcome);
        Assert.Equal(reason, result.Result.Reason);
        Assert.Null(result.Problem);
    }

    [Fact]
    public async Task SoftDeleteOrphan_503_GivesRetryAfterAndTheProblem()
    {
        _handler.Respond(
            HttpStatusCode.ServiceUnavailable,
            Problem(503, "The estate is busy", "The removal waited too long on another write to the same estate. Nothing was deleted; try again."),
            response => response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(10)));

        var result = await _client.SoftDeleteOedModelOrphan(50005681, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(503, result.HttpStatus);
        Assert.Null(result.Result);
        Assert.Equal(10, result.RetryAfterSeconds);
        Assert.Equal("The estate is busy", result.Problem!.Title);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task SoftDeleteOrphan_TransportFailure_GivesStatus0()
    {
        _handler.Throw(new TaskCanceledException("timed out"));

        var result = await _client.SoftDeleteOedModelOrphan(50005681, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(0, result.HttpStatus);
        Assert.Null(result.Result);
        Assert.Equal("timed out", result.Problem!.Detail);
    }

    [Fact]
    public async Task Copy_UnparseableBody_GivesTheStatusOnly()
    {
        _handler.Respond(HttpStatusCode.BadGateway, "<html>Bad gateway</html>");

        var result = await _client.CopyOedModel(512345, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(502, result.HttpStatus);
        Assert.Null(result.Copy);
        Assert.Null(result.Problem);
    }
}

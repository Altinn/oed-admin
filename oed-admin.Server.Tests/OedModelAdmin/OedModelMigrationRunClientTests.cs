using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Tests.OedModelAdmin;

/// <summary>
/// The OED_M run calls in <see cref="OedSystemAdminClient"/> against oed's answers (Altinn/oed#1923 §4.3, §6).
/// <c>TestData/OedModelAdmin/oed_model_migration_run_*_contract.json</c> are copies of oed's snapshots
/// <c>ApiTest/ContractSnapshots/oed_model_migration_run_{start,get,items,cancel,active,latest_verify}_contract.json</c>
/// (digdir/oed, commit b6efb99b, release 1366). When oed changes one, copy it here again and run these tests.
/// </summary>
public class OedModelMigrationRunClientTests
{
    private const string RunsPath = "/digdir/oed/api/admin/oed-model/migration-runs";
    private static readonly Guid RunId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly StubHandler _handler = new();
    private readonly OedSystemAdminClient _client;

    public OedModelMigrationRunClientTests()
    {
        _client = new OedSystemAdminClient(
            new HttpClient(_handler) { BaseAddress = new Uri("https://digdir.apps.tt02.altinn.no") },
            NullLogger<OedSystemAdminClient>.Instance);
    }

    private static string Snapshot(string name) =>
        File.ReadAllText(Path.Combine("TestData", "OedModelAdmin", $"oed_model_migration_run_{name}_contract.json"));

    private static string Problem(int status, string title, string? detail = null, Guid? activeRunId = null)
    {
        var body = new JsonObject { ["title"] = title, ["status"] = status, ["detail"] = detail };
        if (activeRunId is { } id)
            body["activeRunId"] = id.ToString();
        return body.ToJsonString();
    }

    [Fact]
    public async Task Start_202_SendsTheParametersAndReadsTheQueuedRun()
    {
        _handler.Respond(HttpStatusCode.Accepted, Snapshot("start"));

        var result = await _client.StartMigrationRun(
            new OedModelMigrationRunStart("sweep", 500, null, null, null), CancellationToken.None);

        Assert.Equal(202, result.HttpStatus);
        Assert.Null(result.Problem);
        var run = result.Run!;
        Assert.Equal(RunId, run.Id);
        Assert.Equal("Sweep", run.Mode);
        Assert.Equal("Queued", run.Status);
        Assert.Equal("oed-admin-client", run.RequestedBy);
        Assert.Null(run.Started);
        Assert.Equal(new OedModelMigrationRunParameters(500, 2, 2, null), run.Parameters);
        Assert.Equal(new OedModelMigrationRunProgress(0, 0, 0), run.Progress);
        Assert.Null(run.Ready);
        Assert.Null(run.Report);

        Assert.Equal(HttpMethod.Post, _handler.Request!.Method);
        Assert.Equal(RunsPath, _handler.Request.RequestUri!.AbsolutePath);
        var sent = JsonNode.Parse(_handler.RequestBody!)!;
        Assert.Equal("sweep", sent["mode"]!.GetValue<string>());
        Assert.Equal(500, sent["limit"]!.GetValue<int>());
        // Null, so oed fills in its defaults.
        Assert.Null(sent["ratePerSecond"]);
        Assert.Null(sent["sampleSize"]);
    }

    [Fact]
    public async Task Start_409_GivesTheActiveRunAndTheDetail()
    {
        var active = Guid.NewGuid();
        _handler.Respond(HttpStatusCode.Conflict, Problem(409, "A run is already active", "Another OED_M migration run is queued or running. Wait for it, or cancel it.", active));

        var result = await _client.StartMigrationRun(new OedModelMigrationRunStart("verify", null, null, null, null), CancellationToken.None);

        Assert.Equal(409, result.HttpStatus);
        Assert.Null(result.Run);
        Assert.Equal(active, result.ActiveRunId);
        Assert.Equal("Another OED_M migration run is queued or running. Wait for it, or cancel it.", result.Problem!.Detail);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task Start_400_ReadsTheValidationErrors()
    {
        _handler.Respond(HttpStatusCode.BadRequest, """
            {"title":"One or more validation errors occurred.","status":400,"errors":{"limit":["limit applies to a sweep only"]}}
            """);

        var result = await _client.StartMigrationRun(new OedModelMigrationRunStart("verify", 5, null, null, null), CancellationToken.None);

        Assert.Equal(400, result.HttpStatus);
        Assert.Equal(["limit applies to a sweep only"], result.Problem!.Errors!["limit"]);
    }

    [Fact]
    public async Task Get_200_ReadsTheReport()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("get"));

        var result = await _client.GetMigrationRun(RunId, CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        var run = result.Run!;
        Assert.Equal("Verify", run.Mode);
        Assert.Equal("Completed", run.Status);
        Assert.Equal(new DateTimeOffset(2026, 11, 17, 10, 30, 0, TimeSpan.FromHours(2)), run.Finished);
        Assert.Equal(new OedModelMigrationRunProgress(1200, 1200, 1200), run.Progress);
        Assert.Equal(200, run.Parameters.SampleSize);
        Assert.False(run.Ready);
        var report = run.Report!;
        Assert.Equal(1180, report.Outcomes["Ok"]);
        Assert.Equal(15, report.Outcomes["Missing"]);
        Assert.Equal(3, report.FailuresByReason["RoundTrip"]);
        Assert.Equal(1, report.DuplicateOwnerCount);
        Assert.Equal([512345], report.DuplicateOwnerPartyIds);
        Assert.Equal(2, report.DatabaseCreatedRows);
        Assert.Equal(200, report.Sampled);
        Assert.False(report.Ready);
        Assert.Equal($"{RunsPath}/{RunId}", _handler.Request!.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task Get_404_GivesTheProblem()
    {
        _handler.Respond(HttpStatusCode.NotFound, Problem(404, "The run does not exist", "No OED_M migration run has that id."));

        var result = await _client.GetMigrationRun(Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(404, result.HttpStatus);
        Assert.Null(result.Run);
        Assert.Equal("The run does not exist", result.Problem!.Title);
    }

    [Fact]
    public async Task Active_200_ReadsTheRunningRun()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("active"));

        var result = await _client.GetActiveMigrationRun(CancellationToken.None);

        Assert.Equal("Running", result.Run!.Status);
        Assert.Equal(new DateTimeOffset(2026, 11, 17, 10, 29, 55, TimeSpan.FromHours(2)), result.Run.Heartbeat);
        Assert.Equal($"{RunsPath}/active", _handler.Request!.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task Active_404_MeansNoRun()
    {
        _handler.Respond(HttpStatusCode.NotFound, Problem(404, "No run is active", "No OED_M migration run is queued or running."));

        var result = await _client.GetActiveMigrationRun(CancellationToken.None);

        Assert.Equal(404, result.HttpStatus);
        Assert.Null(result.Run);
    }

    [Fact]
    public async Task LatestVerify_200_ReadsReady()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("latest_verify"));

        var result = await _client.GetLatestVerifyRun(CancellationToken.None);

        Assert.False(result.Run!.Ready);
        Assert.Equal("Completed", result.Run.Status);
        Assert.Equal($"{RunsPath}/latest-verify", _handler.Request!.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task Cancel_202_ReadsWhoAsked()
    {
        _handler.Respond(HttpStatusCode.Accepted, Snapshot("cancel"));

        var result = await _client.CancelMigrationRun(RunId, CancellationToken.None);

        Assert.Equal(202, result.HttpStatus);
        Assert.Equal("oed-admin-client", result.Run!.CancelRequestedBy);
        Assert.Equal(HttpMethod.Post, _handler.Request!.Method);
        Assert.Equal($"{RunsPath}/{RunId}/cancel", _handler.Request.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task Cancel_409_KeepsTheDetail_AndDoesNotRetry()
    {
        _handler.Respond(HttpStatusCode.Conflict, Problem(409, "The run has finished", "The run is Completed; only a queued or running run can be cancelled."));

        var result = await _client.CancelMigrationRun(RunId, CancellationToken.None);

        Assert.Equal(409, result.HttpStatus);
        Assert.Equal("The run is Completed; only a queued or running run can be cancelled.", result.Problem!.Detail);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task Items_200_ReadsThePage_AndSendsTheFilter()
    {
        _handler.Respond(HttpStatusCode.OK, Snapshot("items"));

        var result = await _client.GetMigrationRunItems(RunId, "Failed", 2, 50, CancellationToken.None);

        Assert.Equal(200, result.HttpStatus);
        var page = result.Items!;
        Assert.Equal(2, page.Total);
        Assert.Equal(2, page.Items.Count);
        var failed = page.Items[1];
        Assert.Equal(Guid.Parse("33333333-3333-3333-3333-333333333333"), failed.InstanceGuid);
        Assert.Equal(501337, failed.InstanceOwnerPartyId);
        Assert.Equal("Failed", failed.Outcome);
        Assert.Equal("RoundTrip", failed.Failure);
        Assert.Equal("oed/Heirs/HeirInfo[1]/Name", failed.Reason);
        Assert.Equal(2, failed.Attempts);
        Assert.Equal(["oed/Heirs/HeirInfo/Obsolete"], page.Items[0].DroppedElements);
        Assert.Equal($"{RunsPath}/{RunId}/items", _handler.Request!.RequestUri!.AbsolutePath);
        Assert.Equal("?page=2&pageSize=50&outcome=Failed", _handler.Request.RequestUri.Query);
    }

    [Fact]
    public async Task Items_WithoutOutcome_LeavesItOut()
    {
        // oed refuses `outcome=`: an empty value is not an outcome name.
        _handler.Respond(HttpStatusCode.OK, Snapshot("items"));

        await _client.GetMigrationRunItems(RunId, null, 1, 100, CancellationToken.None);

        Assert.Equal("?page=1&pageSize=100", _handler.Request!.RequestUri!.Query);
    }

    [Fact]
    public async Task Items_400_ReadsTheValidationErrors()
    {
        _handler.Respond(HttpStatusCode.BadRequest, """{"title":"x","status":400,"errors":{"outcome":["outcome must be one of Copied"]}}""");

        var result = await _client.GetMigrationRunItems(RunId, "Nope", 1, 100, CancellationToken.None);

        Assert.Equal(400, result.HttpStatus);
        Assert.Null(result.Items);
        Assert.NotNull(result.Problem!.Errors!["outcome"]);
    }

    [Fact]
    public async Task Run_TransportFailure_GivesStatus0()
    {
        _handler.Throw(new HttpRequestException("connection refused"));

        var result = await _client.CancelMigrationRun(RunId, CancellationToken.None);

        Assert.Equal(0, result.HttpStatus);
        Assert.Null(result.Run);
        Assert.Equal("connection refused", result.Problem!.Detail);
        Assert.Equal(1, _handler.Calls);
    }

    [Fact]
    public async Task Items_TransportFailure_GivesStatus0()
    {
        _handler.Throw(new TaskCanceledException("timed out"));

        var result = await _client.GetMigrationRunItems(RunId, null, 1, 100, CancellationToken.None);

        Assert.Equal(0, result.HttpStatus);
        Assert.Null(result.Items);
    }

    [Fact]
    public async Task Run_UnparseableBody_GivesTheStatusOnly()
    {
        _handler.Respond(HttpStatusCode.BadGateway, "<html>Bad gateway</html>");

        var result = await _client.GetActiveMigrationRun(CancellationToken.None);

        Assert.Equal(502, result.HttpStatus);
        Assert.Null(result.Run);
        Assert.Null(result.Problem);
    }
}

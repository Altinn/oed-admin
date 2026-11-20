using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using oed_admin.Server.Features;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Auditing;
using oed_admin.Server.Infrastructure.Auditing.Loggers;
using oed_admin.Server.Infrastructure.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Tests.OedModelAdmin;

/// <summary>
/// The OED_M admin endpoints through the real pipeline on Kestrel (<c>UseAuditLogging</c>, <c>MapFeatureEndpoints</c>, the policies
/// from <c>AddAuth</c>), with a test sign-in instead of Entra ID, a fake oed, and a real Postgres for the run items'
/// estate lookup (Altinn/oed#1923 §6).
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class OedModelEndpointTests(PostgresFixture fixture) : IAsyncLifetime
{
    private const string UserName = "Ola Nordmann";
    private const string UserObjectId = "0b5e2b8c-1111-2222-3333-444455556666";
    private const string InstanceGuid = "55555555-5555-5555-5555-555555555555";
    private const string RunId = "11111111-1111-1111-1111-111111111111";

    private readonly FakeOedSystemAdminClient _oed = new();
    private readonly CapturingLoggerProvider _logs = new();
    private readonly CapturingAuditLogger _audit = new();
    private WebApplication _app = null!;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        // Real Kestrel, not TestServer: TestServer's request stream supports Length and hid a 500 that Kestrel's raised
        // in the audit middleware.
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders().AddProvider(_logs);
        builder.Services.AddAuth(builder.Environment, builder.Configuration);
        builder.Services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = TestAuthHandler.SchemeName;
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                options.DefaultForbidScheme = TestAuthHandler.SchemeName;
            })
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        builder.Services.AddSingleton<IOedSystemAdminClient>(_oed);
        builder.Services.AddSingleton<IAuditLogger>(_audit);
        builder.Services.AddOedDatabase(fixture.ConnectionString);

        // As Program.cs: the audit middleware wraps every endpoint.
        _app = builder.Build();
        _app.UseAuditLogging();
        _app.MapFeatureEndpoints();
        await _app.StartAsync();
    }

    public async Task DisposeAsync() => await _app.DisposeAsync();

    private HttpClient Client(params string[] roles)
    {
        var client = new HttpClient { BaseAddress = new Uri(_app.Urls.First()) };
        if (roles.Length > 0)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return client;
    }

    private static Task<HttpResponseMessage> Send(HttpClient client, string route) => route switch
    {
        "GET phase" => client.GetAsync("/api/maintenance/oedmodel/phase"),
        "PUT phase" => client.PutAsJsonAsync("/api/maintenance/oedmodel/phase", new { phase = "Storage", reason = "pause" }),
        "POST copy" => client.PostAsync($"/api/maintenance/oedmodel/estates/512345/{InstanceGuid}/copy", null),
        "POST run" => client.PostAsJsonAsync("/api/maintenance/oedmodel/runs", new { mode = "verify" }),
        "GET active run" => client.GetAsync("/api/maintenance/oedmodel/runs/active"),
        "GET latest verify" => client.GetAsync("/api/maintenance/oedmodel/runs/latest-verify"),
        "GET run" => client.GetAsync($"/api/maintenance/oedmodel/runs/{RunId}"),
        "GET run items" => client.GetAsync($"/api/maintenance/oedmodel/runs/{RunId}/items?outcome=Failed"),
        "POST run cancel" => client.PostAsync($"/api/maintenance/oedmodel/runs/{RunId}/cancel", null),
        _ => throw new ArgumentOutOfRangeException(nameof(route)),
    };

    public static TheoryData<string> Routes =>
    [
        "GET phase", "PUT phase", "POST copy",
        "POST run", "GET active run", "GET latest verify", "GET run", "GET run items", "POST run cancel",
    ];

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task ReadRole_IsRefused_AndOedIsNotCalled(string route)
    {
        var response = await Send(Client("Read"), route);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task NoRole_IsRefused_AndOedIsNotCalled(string route)
    {
        var response = await Send(Client("SomethingElse"), route);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Anonymous_IsRefused_AndOedIsNotCalled(string route)
    {
        var response = await Send(Client(), route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AdminRole_ReachesOed_AndIsAudited(string route)
    {
        var response = await Send(Client("Admin"), route);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, _oed.Calls);
        var record = Assert.Single(_audit.Records);
        Assert.Equal(200, record.Response.StatusCode);
        Assert.Equal(UserObjectId, record.User.Id);
    }

    [Fact]
    public async Task Copy_IsAuditedWithTheInstanceInThePath()
    {
        // A POST without a body: the audit middleware once threw reading Kestrel's unbuffered Body.Length here.
        var response = await Client("Admin").PostAsync($"/api/maintenance/oedmodel/estates/512345/{InstanceGuid}/copy", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var record = Assert.Single(_audit.Records);
        Assert.Equal($"/api/maintenance/oedmodel/estates/512345/{InstanceGuid}/copy", record.Request.RequestPath);
    }

    [Fact]
    public async Task SetPhase_IsAuditedWithTheRequestBody()
    {
        await Client("Admin").PutAsJsonAsync("/api/maintenance/oedmodel/phase", new { phase = "Storage", reason = "pause" });

        var record = Assert.Single(_audit.Records);
        Assert.Contains("pause", record.Request.Body);
    }

    [Theory]
    [InlineData("PUT phase")]
    [InlineData("POST copy")]
    public async Task StateChangingCalls_AreNotCancelledWithTheRequest(string route)
    {
        // Once oed has the call it may commit; a closed tab must not cut it off before the log line.
        await Send(Client("Admin"), route);

        Assert.False(_oed.LastToken.CanBeCanceled);
    }

    [Fact]
    public async Task SetPhase_PutsTheUserInTheReasonAndTheLog()
    {
        var response = await Client("Admin").PutAsJsonAsync(
            "/api/maintenance/oedmodel/phase", new { phase = "Migrating", reason = "  canary done " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Migrating", _oed.LastPhase);
        Assert.Equal($"canary done (oed-admin: {UserName}, oid {UserObjectId})", _oed.LastReason);
        var log = Assert.Single(_logs.Messages, m => m.Contains("OED_M phase change"));
        Assert.Contains(UserName, log);
        Assert.Contains(UserObjectId, log);
        Assert.Contains("Migrating", log);
    }

    [Fact]
    public async Task Copy_PutsTheUserAndTheInstanceInTheLog()
    {
        var response = await Client("Admin").PostAsync($"/api/maintenance/oedmodel/estates/512345/{InstanceGuid}/copy", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((512345, Guid.Parse(InstanceGuid)), _oed.LastCopy);
        var log = Assert.Single(_logs.Messages, m => m.Contains("OED_M copy"));
        Assert.Contains(UserName, log);
        Assert.Contains(UserObjectId, log);
        Assert.Contains($"512345/{InstanceGuid}", log);
        Assert.Contains("Copied", log);
    }

    [Theory]
    [InlineData("Storage", null)]
    [InlineData("Storage", "   ")]
    [InlineData("storage", "pause")]
    [InlineData("Nope", "pause")]
    [InlineData(null, "pause")]
    public async Task SetPhase_InvalidRequest_IsRefusedBeforeOed(string? phase, string? reason)
    {
        var response = await Client("Admin").PutAsJsonAsync("/api/maintenance/oedmodel/phase", new { phase, reason });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Fact]
    public async Task SetPhase_409_IsHandedBackVerbatim()
    {
        _oed.PhaseAnswer = new OedModelPhaseResult(
            409, null, new OedAdminProblem("The phase can't be set to Database", "No verify run exists yet (#1902)", null));

        var response = await Client("Admin").PutAsJsonAsync(
            "/api/maintenance/oedmodel/phase", new { phase = "Database", reason = "test" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal(409, body["status"]!.GetValue<int>());
        Assert.Equal("No verify run exists yet (#1902)", body["problem"]!["detail"]!.GetValue<string>());
        Assert.Equal(1, _oed.Calls);
    }

    [Fact]
    public async Task Copy_503_HandsBackRetryAfter()
    {
        _oed.CopyAnswer = new OedModelCopyResult(503, null, new OedAdminProblem("The estate is busy", "try again", null), 10);

        var response = await Client("Admin").PostAsync($"/api/maintenance/oedmodel/estates/512345/{InstanceGuid}/copy", null);

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal(503, body["status"]!.GetValue<int>());
        Assert.Equal(10, body["retryAfterSeconds"]!.GetValue<int>());
        Assert.Equal(1, _oed.Calls);
    }


    [Fact]
    public async Task StartRun_PutsTheUserInTheLog_AndSendsTheParameters()
    {
        var response = await Client("Admin").PostAsJsonAsync(
            "/api/maintenance/oedmodel/runs", new { mode = "sweep", limit = 20, ratePerSecond = 1.5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new OedModelMigrationRunStart("sweep", 20, 1.5, null, null), _oed.LastStart);
        var log = Assert.Single(_logs.Messages, m => m.Contains("OED_M sweep run requested"));
        Assert.Contains(UserName, log);
        Assert.Contains(UserObjectId, log);
        Assert.Contains("limit 20", log);
        Assert.Contains(RunId, log);
        var record = Assert.Single(_audit.Records);
        Assert.Contains("\"sweep\"", record.Request.Body);
    }

    [Fact]
    public async Task CancelRun_PutsTheUserAndTheRunInTheLog()
    {
        var response = await Client("Admin").PostAsync($"/api/maintenance/oedmodel/runs/{RunId}/cancel", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Guid.Parse(RunId), _oed.LastCancel);
        var log = Assert.Single(_logs.Messages, m => m.Contains("cancel requested"));
        Assert.Contains(UserName, log);
        Assert.Contains(UserObjectId, log);
        Assert.Contains(RunId, log);
    }

    [Theory]
    [InlineData("POST run")]
    [InlineData("POST run cancel")]
    public async Task RunStateChanges_AreNotCancelledWithTheRequest(string route)
    {
        await Send(Client("Admin"), route);

        Assert.False(_oed.LastToken.CanBeCanceled);
    }

    public static TheoryData<string> InvalidStarts =>
    [
        """{"mode":"Sweep"}""",
        """{"mode":"nope"}""",
        """{"mode":"verify","limit":5}""",
        """{"mode":"sweep","limit":0}""",
        """{"mode":"sweep","sampleSize":10}""",
        """{"mode":"verify","sampleSize":10001}""",
        """{"mode":"sweep","ratePerSecond":0}""",
        """{"mode":"sweep","ratePerSecond":10.5}""",
        """{"mode":"sweep","maxParallelism":11}""",
    ];

    [Theory]
    [MemberData(nameof(InvalidStarts))]
    public async Task StartRun_InvalidRequest_IsRefusedBeforeOed(string body)
    {
        var response = await Client("Admin").PostAsync(
            "/api/maintenance/oedmodel/runs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Theory]
    [InlineData("outcome=Nope")]
    [InlineData("page=0")]
    [InlineData("pageSize=501")]
    public async Task RunItems_InvalidQuery_IsRefusedBeforeOed(string query)
    {
        var response = await Client("Admin").GetAsync($"/api/maintenance/oedmodel/runs/{RunId}/items?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _oed.Calls);
    }

    [Fact]
    public async Task StartRun_409_HandsBackTheActiveRun()
    {
        var active = Guid.NewGuid();
        _oed.RunAnswer = new OedModelMigrationRunResult(
            409, null, new OedAdminProblem("A run is already active", "Wait for it, or cancel it.", null), active);

        var response = await Client("Admin").PostAsJsonAsync("/api/maintenance/oedmodel/runs", new { mode = "verify" });

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal(409, body["status"]!.GetValue<int>());
        Assert.Equal(active, body["activeRunId"]!.GetValue<Guid>());
        Assert.Equal("Wait for it, or cancel it.", body["problem"]!["detail"]!.GetValue<string>());
        Assert.Equal(1, _oed.Calls);
    }

    [Fact]
    public async Task RunItems_LinkEachItemToItsEstate_WhenOneExists()
    {
        var known = Guid.NewGuid();
        var unknown = Guid.NewGuid();
        var estateId = await fixture.InsertEstate(known, 512346);
        _oed.ItemsAnswer = new OedModelMigrationRunItemsResult(200, new OedModelMigrationRunItems(
            [Item(known, 512346), Item(unknown, 512347)], 1, 100, 2), null);

        var response = await Client("Admin").GetAsync($"/api/maintenance/oedmodel/runs/{RunId}/items?outcome=Failed&page=1");

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal(200, body["status"]!.GetValue<int>());
        Assert.Equal(2, body["total"]!.GetValue<int>());
        var items = body["items"]!.AsArray();
        Assert.Equal(estateId, items[0]!["estateId"]!.GetValue<Guid>());
        Assert.Equal(known, items[0]!["run"]!["instanceGuid"]!.GetValue<Guid>());
        Assert.Null(items[1]!["estateId"]);
        Assert.Equal(("Failed", 1, 100), _oed.LastItemsQuery);
    }

    private static OedModelMigrationRunItem Item(Guid instanceGuid, int partyId) =>
        new(instanceGuid, partyId, "Failed", "RoundTrip", "oed/Heirs", [], null, 1, DateTimeOffset.UnixEpoch);

    private sealed class FakeOedSystemAdminClient : IOedSystemAdminClient
    {
        private int _calls;
        public int Calls => _calls;
        public string? LastPhase { get; private set; }
        public string? LastReason { get; private set; }
        public (int PartyId, Guid InstanceGuid)? LastCopy { get; private set; }
        public CancellationToken LastToken { get; private set; }

        public OedModelPhaseResult PhaseAnswer { get; set; } = new(
            200, new OedModelPhaseState("Storage", "pause", DateTimeOffset.UnixEpoch, "oed-admin-client", "Storage"), null);

        public OedModelCopyResult CopyAnswer { get; set; } = new(
            200, new OedModelCopy("Copied", null, null, [], DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch), null, null);

        public Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(Guid estateId, bool overwrite, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<OedModelPhaseResult> GetOedModelPhase(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            return Task.FromResult(PhaseAnswer);
        }

        public Task<OedModelPhaseResult> SetOedModelPhase(string phase, string reason, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            LastPhase = phase;
            LastReason = reason;
            LastToken = cancellationToken;
            return Task.FromResult(PhaseAnswer);
        }

        public Task<OedModelCopyResult> CopyOedModel(int partyId, Guid instanceGuid, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            LastCopy = (partyId, instanceGuid);
            LastToken = cancellationToken;
            return Task.FromResult(CopyAnswer);
        }

        public OedModelMigrationRunStart? LastStart { get; private set; }
        public Guid? LastCancel { get; private set; }
        public (string? Outcome, int Page, int PageSize)? LastItemsQuery { get; private set; }

        public OedModelMigrationRunResult RunAnswer { get; set; } = new(
            200,
            new OedModelMigrationRun(
                Guid.Parse(RunId), "Verify", "Running", "oed-admin-client", null, null, DateTimeOffset.UnixEpoch, null, null, null,
                new OedModelMigrationRunParameters(null, 2, 2, 200), new OedModelMigrationRunProgress(0, 0, 0), null, null, null),
            null,
            null);

        public OedModelMigrationRunItemsResult ItemsAnswer { get; set; } = new(200, new OedModelMigrationRunItems([], 1, 100, 0), null);

        public Task<OedModelMigrationRunResult> StartMigrationRun(OedModelMigrationRunStart start, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            LastStart = start;
            LastToken = cancellationToken;
            return Task.FromResult(RunAnswer);
        }

        public Task<OedModelMigrationRunResult> GetMigrationRun(Guid runId, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            return Task.FromResult(RunAnswer);
        }

        public Task<OedModelMigrationRunResult> GetActiveMigrationRun(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            return Task.FromResult(RunAnswer);
        }

        public Task<OedModelMigrationRunResult> GetLatestVerifyRun(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            return Task.FromResult(RunAnswer);
        }

        public Task<OedModelMigrationRunResult> CancelMigrationRun(Guid runId, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            LastCancel = runId;
            LastToken = cancellationToken;
            return Task.FromResult(RunAnswer);
        }

        public Task<OedModelMigrationRunItemsResult> GetMigrationRunItems(
            Guid runId, string? outcome, int page, int pageSize, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            LastItemsQuery = (outcome, page, pageSize);
            return Task.FromResult(ItemsAnswer);
        }
    }

    /// <summary>Signs in <see cref="UserName"/> with the roles in a header; no header, no sign-in.</summary>
    private sealed class TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string SchemeName = "Test";
        public const string RolesHeader = "X-Test-Roles";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(RolesHeader, out var roles))
                return Task.FromResult(AuthenticateResult.NoResult());

            var claims = new List<Claim> { new("name", UserName), new("oid", UserObjectId) };
            claims.AddRange(roles.ToString().Split(',').Select(role => new Claim(ClaimTypes.Role, role)));
            var identity = new ClaimsIdentity(claims, SchemeName, "name", ClaimTypes.Role);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
        }
    }

    private sealed class CapturingAuditLogger : IAuditLogger
    {
        public ConcurrentQueue<AuditLogRecord> Records { get; } = new();

        public Task LogAsync(AuditLogRecord logRecord)
        {
            Records.Enqueue(logRecord);
            return Task.CompletedTask;
        }
    }

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public ConcurrentQueue<string> Queue { get; } = new();
        public IEnumerable<string> Messages => Queue;

        public ILogger CreateLogger(string categoryName) => new CapturingLogger(Queue);

        public void Dispose()
        {
            // Nothing to release.
        }

        private sealed class CapturingLogger(ConcurrentQueue<string> queue) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                queue.Enqueue(formatter(state, exception));
        }
    }
}

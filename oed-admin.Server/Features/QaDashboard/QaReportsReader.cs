using System.Globalization;
using System.Text.Json;
using Azure.Identity;
using Azure.Storage.Blobs;

namespace oed_admin.Server.Features.QaDashboard;

// Reads the per-run SonarQube snapshot JSON the Altinn.Dd.Tests.SonarGate package archives to the
// oedqa "{project}/history/*.json" blobs, and aggregates it into the QA dashboard model. This is
// the native-render counterpart to the package's own HTML dashboard; the data is the source of truth.
public sealed class QaReportsReader
{
    private const int HistoryRows = 30;

    private readonly BlobContainerClient _container;

    public QaReportsReader(string storageAccount, string container)
    {
        _container = CreateContainerClient(storageAccount, container);
    }

    public async Task<QaDashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        // List every "{project}/history/*.json". Names are yyyyMMdd-HHmmss, so ordinal desc == newest first.
        var byProject = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        await foreach (var blob in _container.GetBlobsAsync(cancellationToken: cancellationToken))
        {
            var parts = blob.Name.Split('/');
            if (parts.Length < 3 || parts[1] != "history"
                || !parts[2].EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!byProject.TryGetValue(parts[0], out var list))
            {
                byProject[parts[0]] = list = [];
            }
            list.Add(blob.Name);
        }

        var projects = new List<QaProject>();
        foreach (var (name, blobs) in byProject)
        {
            var newestFirst = blobs.OrderByDescending(b => b, StringComparer.Ordinal).Take(HistoryRows).ToList();
            var snapshots = new List<QaSnapshot>();
            for (var i = 0; i < newestFirst.Count; i++)
            {
                // Only the latest snapshot carries the top-N findings drilldown.
                var snapshot = await ReadSnapshotAsync(newestFirst[i], includeTop: i == 0, cancellationToken);
                if (snapshot is not null)
                {
                    snapshots.Add(snapshot);
                }
            }

            if (snapshots.Count > 0)
            {
                projects.Add(new QaProject(name, snapshots));
            }
        }

        return new QaDashboardDto(projects.OrderBy(p => p.Name, StringComparer.Ordinal).ToList());
    }

    private async Task<QaSnapshot?> ReadSnapshotAsync(string blobName, bool includeTop, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _container.GetBlobClient(blobName).DownloadStreamingAsync(cancellationToken: cancellationToken);
            using var doc = await JsonDocument.ParseAsync(response.Value.Content, cancellationToken: cancellationToken);
            var root = doc.RootElement;

            var timestamp = DateTimeOffset.Parse(
                root.GetProperty("timestamp").GetString()!,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind);
            var status = root.GetProperty("qualityGate").GetProperty("status").GetString() ?? "?";

            var metrics = new Dictionary<string, string>(StringComparer.Ordinal);
            if (root.TryGetProperty("metrics", out var metricsElement))
            {
                foreach (var metric in metricsElement.EnumerateObject())
                {
                    metrics[metric.Name] = metric.Value.GetString() ?? "";
                }
            }

            return new QaSnapshot(
                timestamp,
                status,
                metrics,
                includeTop ? ReadFindings(root, "bugs") : [],
                includeTop ? ReadFindings(root, "codeSmells") : [],
                includeTop ? ReadHotspots(root) : []);
        }
        catch
        {
            // A single malformed snapshot shouldn't take down the whole dashboard — skip it.
            return null;
        }
    }

    private static IReadOnlyList<QaFinding> ReadFindings(JsonElement root, string property)
    {
        if (!root.TryGetProperty("top", out var top) || !top.TryGetProperty(property, out var arr))
        {
            return [];
        }

        var list = new List<QaFinding>();
        foreach (var item in arr.EnumerateArray())
        {
            list.Add(new QaFinding(
                Str(item, "rule"),
                Str(item, "severity"),
                Str(item, "component"),
                Int(item, "line"),
                Str(item, "message")));
        }
        return list;
    }

    private static IReadOnlyList<QaHotspot> ReadHotspots(JsonElement root)
    {
        if (!root.TryGetProperty("top", out var top) || !top.TryGetProperty("hotspots", out var arr))
        {
            return [];
        }

        var list = new List<QaHotspot>();
        foreach (var item in arr.EnumerateArray())
        {
            list.Add(new QaHotspot(
                Str(item, "rule"),
                Str(item, "vulnerabilityProbability"),
                Str(item, "securityCategory"),
                Str(item, "component"),
                Int(item, "line"),
                Str(item, "message")));
        }
        return list;
    }

    private static string Str(JsonElement el, string name)
        => el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static int? Int(JsonElement el, string name)
        => el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;

    // SAS token if provided (handy for local dev without an AAD data-plane role), otherwise
    // DefaultAzureCredential — the app's managed identity in Azure, or `az login` locally.
    private static BlobContainerClient CreateContainerClient(string storageAccount, string container)
    {
        var sas = Environment.GetEnvironmentVariable("AZURE_STORAGE_SAS_TOKEN");
        if (!string.IsNullOrWhiteSpace(sas))
        {
            if (sas.StartsWith('?'))
            {
                sas = sas[1..];
            }
            return new BlobContainerClient(new Uri($"https://{storageAccount}.blob.core.windows.net/{container}?{sas}"));
        }

        return new BlobServiceClient(new Uri($"https://{storageAccount}.blob.core.windows.net"), new DefaultAzureCredential())
            .GetBlobContainerClient(container);
    }
}

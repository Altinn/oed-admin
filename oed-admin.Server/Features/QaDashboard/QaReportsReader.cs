using System.Globalization;
using System.Text.Json;
using Azure.Identity;
using Azure.Storage.Blobs;

namespace oed_admin.Server.Features.QaDashboard;

// Reads the per-run SonarQube snapshot JSON the Altinn.Dd.Tests.SonarGate package archives to the
// oedqa "{project}/history/yyyyMMdd-HHmmss.json" blobs, and aggregates it into the QA dashboard
// model. This is the native-render counterpart to the package's own HTML dashboard; the data is
// the source of truth.
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
        var blobNames = new List<string>();
        await foreach (var blob in _container.GetBlobsAsync(cancellationToken: cancellationToken))
        {
            blobNames.Add(blob.Name);
        }

        var projects = new List<QaProject>();
        foreach (var (name, newestFirst) in SelectSnapshotBlobs(blobNames))
        {
            var snapshots = new List<QaSnapshot>();
            foreach (var blobName in newestFirst)
            {
                // Only the latest snapshot carries the top-N findings drilldown. Hang it off the
                // first blob that actually parses rather than the first listed, so one unreadable
                // newest snapshot cannot take the whole drilldown down with it.
                var snapshot = await ReadSnapshotAsync(blobName, includeTop: snapshots.Count == 0, cancellationToken);
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

    // Groups the SonarGate snapshots under "{project}/history/" into newest-first, capped
    // per-project lists.
    // Pure and static so the selection rules can be exercised without blob storage.
    public static Dictionary<string, List<string>> SelectSnapshotBlobs(IEnumerable<string> blobNames)
    {
        var byProject = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var blobName in blobNames)
        {
            var parts = blobName.Split('/');
            if (parts.Length < 3 || parts[1] != "history" || !IsSonarSnapshot(parts[2]))
            {
                continue;
            }

            if (!byProject.TryGetValue(parts[0], out var list))
            {
                byProject[parts[0]] = list = [];
            }
            list.Add(blobName);
        }

        // Names are yyyyMMdd-HHmmss, so ordinal desc == newest first.
        var selected = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var (project, list) in byProject)
        {
            selected[project] = list.OrderByDescending(b => b, StringComparer.Ordinal).Take(HistoryRows).ToList();
        }
        return selected;
    }

    // SonarGate names its snapshots "yyyyMMdd-HHmmss.json". Sibling gates archive under the same
    // "{project}/history/" prefix with their own prefixed names — DependencyGate writes
    // "deps-yyyyMMdd-HHmmss.json" — so match this gate's pattern rather than taking every *.json.
    private static bool IsSonarSnapshot(string fileName)
    {
        const string Extension = ".json";
        const int StampLength = 15; // yyyyMMdd-HHmmss

        if (fileName.Length != StampLength + Extension.Length
            || !fileName.EndsWith(Extension, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        for (var i = 0; i < StampLength; i++)
        {
            var ok = i == 8 ? fileName[i] == '-' : char.IsAsciiDigit(fileName[i]);
            if (!ok)
            {
                return false;
            }
        }

        return true;
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

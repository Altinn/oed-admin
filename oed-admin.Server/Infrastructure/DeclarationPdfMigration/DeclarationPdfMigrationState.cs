namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

public enum RunStatus { Idle, Running, Completed, Cancelled, Aborted, Faulted }

public record MigrationFailure(Guid EstateId, string Reason, string? Detail, int Status);

public record ProgressSnapshot(
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    bool DryRun,
    bool Overwrite,
    int? Limit,
    int Total,
    int Processed,
    IReadOnlyDictionary<string, int> Outcomes,
    int FailureCount,
    IReadOnlyList<MigrationFailure> Failures,
    string? Error);

/// <summary>
/// All state for the current (or most recently finished) declaration-pdf migration run.
/// Registered as a singleton; written by the background service, read by the SSE endpoint.
/// State is deliberately not persisted - a restart means starting the sweep again, which is
/// cheap because migrated estates return AlreadyMigrated.
/// </summary>
public class DeclarationPdfMigrationState
{
    /// <summary>Every counter key the UI can be shown. Anything else is folded into "Unknown".</summary>
    public static readonly IReadOnlyList<string> OutcomeKeys =
    [
        "Copied",
        "Overwritten",
        "AlreadyMigrated",
        "NoPdfOnDeclaration",
        "NoDeclarationInstance",
        // The estate's own oed instance is gone, so there is nowhere to write the PDF.
        // Permanent, and the dominant outcome of the first TT02 sweep.
        "NoOedInstance",
        "EstateNotFound",
        "InvalidEstateData",
        "StorageError",
        "Unknown"
    ];

    private readonly Lock _gate = new();
    private readonly List<MigrationFailure> _failures = [];
    private readonly Dictionary<string, int> _outcomes = new();

    private RunStatus _status = RunStatus.Idle;
    private DeclarationPdfMigrationTrigger? _trigger;
    private DateTimeOffset? _startedAt;
    private DateTimeOffset? _endedAt;
    private CancellationTokenSource? _cancellationTokenSource;
    private int _total;
    private int _processed;
    private volatile bool _abortRequested;
    private string? _error;

    public int Processed
    {
        get
        {
            lock (_gate) return _processed;
        }
    }

    public bool AbortRequested => _abortRequested;

    public int FailureCount
    {
        get
        {
            lock (_gate) return _failures.Count;
        }
    }

    /// <summary>
    /// The single guard against two overlapping runs. Resets all state on success.
    /// </summary>
    public bool TryBeginRun(DeclarationPdfMigrationTrigger trigger)
    {
        lock (_gate)
        {
            if (_status == RunStatus.Running)
                return false;

            _status = RunStatus.Running;
            _trigger = trigger;
            _startedAt = trigger.Timestamp;
            _endedAt = null;
            _total = 0;
            _processed = 0;
            _abortRequested = false;
            _error = null;
            _failures.Clear();
            _outcomes.Clear();
            return true;
        }
    }

    public void SetCancellationSource(CancellationTokenSource? cancellationTokenSource)
    {
        lock (_gate) _cancellationTokenSource = cancellationTokenSource;
    }

    /// <summary>Cancels the active run. Returns false when there is nothing to cancel.</summary>
    public bool TryCancel()
    {
        lock (_gate)
        {
            if (_status != RunStatus.Running || _cancellationTokenSource is null)
                return false;

            _cancellationTokenSource.Cancel();
            return true;
        }
    }

    /// <summary>Marks the run as aborting because the oed endpoint refused our token.</summary>
    public void RequestAbort() => _abortRequested = true;

    public void SetTotal(int total)
    {
        lock (_gate) _total = total;
    }

    /// <summary>Increments the counter for one outcome. Returns the new processed count.</summary>
    public int RecordOutcome(string outcomeKey)
    {
        lock (_gate)
        {
            _outcomes.TryGetValue(outcomeKey, out var count);
            _outcomes[outcomeKey] = count + 1;
            return ++_processed;
        }
    }

    public void RecordFailure(MigrationFailure failure)
    {
        lock (_gate) _failures.Add(failure);
    }

    public void EndRun(RunStatus status, string? error = null)
    {
        lock (_gate)
        {
            _status = status;
            _endedAt = DateTimeOffset.UtcNow;
            _cancellationTokenSource = null;
            _error = error;
        }
    }

    /// <summary>
    /// A snapshot carrying only the failures from <paramref name="fromFailureIndex"/> onwards.
    /// The list is uncapped, so a stream sends everything once and then only what is new.
    /// </summary>
    public ProgressSnapshot GetSnapshot(int fromFailureIndex)
    {
        lock (_gate)
        {
            var from = Math.Clamp(fromFailureIndex, 0, _failures.Count);
            var newFailures = _failures.GetRange(from, _failures.Count - from);

            return new ProgressSnapshot(
                _status.ToString(),
                _startedAt,
                _endedAt,
                _trigger?.DryRun ?? false,
                _trigger?.Overwrite ?? false,
                _trigger?.Limit,
                _total,
                _processed,
                OutcomeKeys.ToDictionary(key => key, key => _outcomes.GetValueOrDefault(key, 0)),
                _failures.Count,
                newFailures,
                _error);
        }
    }
}

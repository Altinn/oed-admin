namespace oed_admin.Server.Infrastructure.EstateCount;

public enum EstateCountStatus { Idle, Running, Completed, Cancelled, Faulted }

/// <param name="HeirRoles">
/// Every distinct heir role on this estate - it belongs to each of those groups. Empty when the
/// count is not grouped by heir role, or when no heir has a role.
/// </param>
public record EstateMatch(Guid EstateId, string? CaseNumber, IReadOnlyList<string> HeirRoles);

public record EstateCountFailure(Guid EstateId, string Reason, string? Detail);

/// <param name="HeirRoleCounts">
/// Hits per heir role that occurs among the hits; empty when the count is not grouped. An estate
/// counts towards every role it has, so these do not add up to MatchCount, which counts distinct
/// estates.
/// </param>
public record EstateCountSnapshot(
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    string? StartedBy,
    EstateCountFilters? Filters,
    int Total,
    int Processed,
    int MatchCount,
    int FailureCount,
    IReadOnlyDictionary<string, int> HeirRoleCounts,
    IReadOnlyList<EstateMatch> Matches,
    IReadOnlyList<EstateCountFailure> Failures,
    string? Error);

/// <summary>
/// All state for the current (or most recently finished) estate count. Registered as a
/// singleton; written by EstateCountService, read by the SSE endpoint. There is one count for
/// the whole app and everyone sees its result. Deliberately not persisted - a restart means
/// starting the count again.
/// </summary>
public class EstateCountState
{
    private readonly Lock _gate = new();
    private readonly List<EstateMatch> _matches = [];
    private readonly List<EstateCountFailure> _failures = [];
    private readonly Dictionary<string, int> _heirRoleCounts = new(StringComparer.Ordinal);

    private EstateCountStatus _status = EstateCountStatus.Idle;
    private EstateCountTrigger? _trigger;
    private DateTimeOffset? _endedAt;
    private CancellationTokenSource? _cancellationTokenSource;
    private int _total;
    private int _processed;
    private string? _error;

    public int Processed
    {
        get
        {
            lock (_gate) return _processed;
        }
    }

    public int MatchCount
    {
        get
        {
            lock (_gate) return _matches.Count;
        }
    }

    public int FailureCount
    {
        get
        {
            lock (_gate) return _failures.Count;
        }
    }

    /// <summary>
    /// The single guard against two overlapping counts. Resets all state on success.
    /// </summary>
    public bool TryBeginRun(EstateCountTrigger trigger)
    {
        lock (_gate)
        {
            if (_status == EstateCountStatus.Running)
                return false;

            _status = EstateCountStatus.Running;
            _trigger = trigger;
            _endedAt = null;
            _total = 0;
            _processed = 0;
            _error = null;
            _matches.Clear();
            _failures.Clear();
            _heirRoleCounts.Clear();
            return true;
        }
    }

    public void SetCancellationSource(CancellationTokenSource? cancellationTokenSource)
    {
        lock (_gate) _cancellationTokenSource = cancellationTokenSource;
    }

    /// <summary>Cancels the active count. Returns false when there is nothing to cancel.</summary>
    public bool TryCancel()
    {
        lock (_gate)
        {
            if (_status != EstateCountStatus.Running || _cancellationTokenSource is null)
                return false;

            _cancellationTokenSource.Cancel();
            return true;
        }
    }

    public void SetTotal(int total)
    {
        lock (_gate) _total = total;
    }

    /// <summary>
    /// Records a matching estate and counts it towards each of its heir roles. Returns the new
    /// processed count.
    /// </summary>
    public int RecordMatch(EstateMatch match)
    {
        lock (_gate)
        {
            _matches.Add(match);
            foreach (var heirRole in match.HeirRoles)
            {
                _heirRoleCounts.TryGetValue(heirRole, out var count);
                _heirRoleCounts[heirRole] = count + 1;
            }
            return ++_processed;
        }
    }

    /// <summary>Records an estate that could not be checked. Returns the new processed count.</summary>
    public int RecordFailure(EstateCountFailure failure)
    {
        lock (_gate)
        {
            _failures.Add(failure);
            return ++_processed;
        }
    }

    public void EndRun(EstateCountStatus status, string? error = null)
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
    /// A snapshot carrying only the matches and failures from the given indexes onwards. A full
    /// count can match 20 000 estates, so a stream sends everything once and then only what is new.
    /// </summary>
    public EstateCountSnapshot GetSnapshot(int fromMatchIndex, int fromFailureIndex)
    {
        lock (_gate)
        {
            var fromMatch = Math.Clamp(fromMatchIndex, 0, _matches.Count);
            var fromFailure = Math.Clamp(fromFailureIndex, 0, _failures.Count);

            return new EstateCountSnapshot(
                _status.ToString(),
                _trigger?.Timestamp,
                _endedAt,
                _trigger?.StartedBy,
                _trigger?.Filters,
                _total,
                _processed,
                _matches.Count,
                _failures.Count,
                // A copy: the live dictionary keeps changing after the lock is released.
                new Dictionary<string, int>(_heirRoleCounts),
                _matches.GetRange(fromMatch, _matches.Count - fromMatch),
                _failures.GetRange(fromFailure, _failures.Count - fromFailure),
                _error);
        }
    }
}

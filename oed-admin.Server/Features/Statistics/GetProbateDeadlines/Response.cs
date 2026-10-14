namespace oed_admin.Server.Features.Statistics.GetProbateDeadlines;

/// <param name="Buckets">Open estates by how far their probate deadline is from now, overdue first.</param>
/// <param name="Weeks">Open estates whose deadline falls in each of the coming ISO weeks, starting with the current one.</param>
public record Response(IReadOnlyList<DeadlineBucketDto> Buckets, IReadOnlyList<DeadlineWeekDto> Weeks);

public record DeadlineBucketDto(string Bucket, int Count);

public record DeadlineWeekDto(DateOnly WeekStart, int Count);

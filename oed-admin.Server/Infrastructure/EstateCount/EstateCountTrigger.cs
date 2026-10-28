namespace oed_admin.Server.Infrastructure.EstateCount;

/// <param name="StartedBy">Display name of the admin who started the count, shown to everyone.</param>
public record EstateCountTrigger(
    DateTimeOffset Timestamp,
    EstateCountFilters Filters,
    string StartedBy);

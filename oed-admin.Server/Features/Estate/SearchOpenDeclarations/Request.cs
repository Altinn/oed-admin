namespace oed_admin.Server.Features.Estate.SearchOpenDeclarations;

/// <summary>
/// <see cref="To"/> is the moment the estates must have been open at; omitted means now. It is the
/// same To as the backlog statistics take, so the list matches the count for that moment.
/// </summary>
public record Request(DateTimeOffset? To)
{
    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() =>
        To is null || To <= DateTimeOffset.UtcNow.AddDays(1);
}

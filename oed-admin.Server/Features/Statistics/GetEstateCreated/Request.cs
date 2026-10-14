namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

public record Request(int? Days)
{
    public const int DefaultDays = 90;

    /// <summary>Bounds the size of a single request; two years is well past what the tab shows.</summary>
    public const int MaxDays = 730;

    public int DaysOrDefault => Days ?? DefaultDays;

    public bool IsValid() => DaysOrDefault is >= 1 and <= MaxDays;
}

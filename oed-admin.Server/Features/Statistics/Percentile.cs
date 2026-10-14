namespace oed_admin.Server.Features.Statistics;

/// <summary>Percentiles over durations, shared by the statistics slices that report lead times.</summary>
public static class Percentile
{
    /// <summary>
    /// The <paramref name="fraction"/> percentile (0.5 is the median) of <paramref name="values"/>,
    /// linearly interpolated between the two nearest ranks and rounded to one decimal. Null when
    /// there are no values.
    /// </summary>
    public static double? Of(IEnumerable<double> values, double fraction)
    {
        var sorted = values.Order().ToArray();
        if (sorted.Length == 0)
            return null;

        var position = (sorted.Length - 1) * fraction;
        var lower = (int)Math.Floor(position);
        var upper = (int)Math.Ceiling(position);
        var value = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);

        return Math.Round(value, 1);
    }
}

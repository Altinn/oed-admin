using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.GetOptions;

public record Response(IReadOnlyList<OptionValue> CaseStatuses, IReadOnlyList<OptionValue> HeirRoles);

public static class Endpoint
{
    public static IResult Get() =>
        TypedResults.Ok(new Response(EstateCountOptions.CaseStatuses, EstateCountOptions.HeirRoles));
}

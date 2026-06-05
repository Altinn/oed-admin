using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.QaDashboard
{
    public class Endpoint
    {
        // Returns the aggregated QA dashboard data (projects -> newest-first snapshots) read from
        // the oedqa "reports" blob container. The React client renders it natively.
        public static async Task<IResult> Get(
            [FromServices] QaReportsReader reader,
            CancellationToken cancellationToken)
        {
            var data = await reader.GetAsync(cancellationToken);
            return TypedResults.Ok(data);
        }
    }
}

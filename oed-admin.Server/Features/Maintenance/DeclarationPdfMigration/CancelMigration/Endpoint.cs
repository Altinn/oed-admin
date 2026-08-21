using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.CancelMigration;

public static class Endpoint
{
    public static IResult Delete([FromServices] DeclarationPdfMigrationState state) =>
        state.TryCancel()
            ? TypedResults.Accepted(string.Empty)
            : TypedResults.NotFound();
}

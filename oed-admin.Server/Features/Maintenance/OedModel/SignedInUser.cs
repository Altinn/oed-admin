using oed_admin.Server.Infrastructure.Auditing;

namespace oed_admin.Server.Features.Maintenance.OedModel;

/// <summary>Who is signed in to oed-admin, for oed's phase reason and oed-admin's log (Altinn/oed#1923 §3).</summary>
public static class SignedInUser
{
    /// <returns>The name, and the Entra object id that ties it to the audit log: <c>Ola Nordmann, oid 1b2c…</c>.</returns>
    public static string Of(HttpContext httpContext) =>
        $"{httpContext.User.GetName()}, oid {httpContext.User.GetObjectId()}";
}

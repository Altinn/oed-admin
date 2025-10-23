using System.Security.Claims;

namespace oed_admin.Server.Infrastructure.Auditing;

public static class ClaimsPrincipalExtensions
{
    public static string GetName(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? principal.Identity.Name ?? "Unknown"
            : "Anonymous";
    }

    public static string[] GetRoles(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? principal.Claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToArray()
            : [];
    }

    public static string GetId(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value ?? "Unknown"
            : "Anonymous";
    }
}
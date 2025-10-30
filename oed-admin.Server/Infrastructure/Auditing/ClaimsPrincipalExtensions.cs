using System.Security.Claims;

namespace oed_admin.Server.Infrastructure.Auditing;

public static class ClaimsPrincipalExtensions
{
    private const string Name = "name";
    private const string Oid = "oid";
    private const string ObjectId = "http://schemas.microsoft.com/identity/claims/objectidentifier";
    
    public static string GetName(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? principal.Identity.Name ?? GetClaimValue(principal, Name) ?? "Unknown"
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

    public static string GetObjectId(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? GetClaimValue(principal, Oid, ObjectId) ?? "Unknown"
            : "Anonymous";
    }

    public static string GetId(this ClaimsPrincipal principal)
    {
        return principal.Identity is not null && principal.Identity.IsAuthenticated
            ? GetClaimValue(principal, ClaimTypes.NameIdentifier) ?? "Unknown"
            : "Anonymous";
    }
    
    private static string? GetClaimValue(ClaimsPrincipal? claimsPrincipal, params string[] claimNames)
    {
        if (claimsPrincipal == null) 
            return null;

        foreach (var t in claimNames)
        {
            var currentValue = claimsPrincipal.FindFirstValue(t);
            if (!string.IsNullOrEmpty(currentValue))
            {
                return currentValue;
            }
        }

        return null;
    }
}
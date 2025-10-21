using Microsoft.AspNetCore.Authorization;
using oed_admin.Server.Infrastructure.EasyAuth;

namespace oed_admin.Server.Infrastructure.Authz;

public static class AuthorizationPolicies
{
    public const string DigitaltDodsboAdmins = "DDAdmins";
    public const string AtLeastReadRole = "AtLeastReadRole";
    public const string RequireAdminRole = "RequireAdminRole";
}

public static class AuthorizationBuilderExtensions
{
    public static AuthorizationBuilder AddDigitaltDodsboPolicies(this AuthorizationBuilder builder, params string[] groups)
    {
        return builder.AddPolicy(
            AuthorizationPolicies.DigitaltDodsboAdmins,
            policyBuilder =>
                policyBuilder
                    .AddAuthenticationSchemes(EasyAuthDefaults.AuthenticationScheme)
                    .RequireClaim(EasyAuthClaims.Groups, groups));
    }
}
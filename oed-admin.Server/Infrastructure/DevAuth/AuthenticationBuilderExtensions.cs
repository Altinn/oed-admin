using Microsoft.AspNetCore.Authentication;

namespace oed_admin.Server.Infrastructure.DevAuth;

public static class AuthenticationBuilderExtensions
{
    public static AuthenticationBuilder AddDevAuth(this AuthenticationBuilder builder,
        Action<AuthenticationSchemeOptions> configure) =>
        builder.AddScheme<AuthenticationSchemeOptions, DevAuthHandler>("DEV", configure);
}
using Microsoft.AspNetCore.Authentication;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public static class EasyAuthAuthenticationBuilderExtensions
{
    public static AuthenticationBuilder AddEasyAuth(this AuthenticationBuilder builder,
        Action<EasyAuthOptions> configure) =>
        builder.AddScheme<EasyAuthOptions, EasyAuthHandler>(EasyAuthDefaults.AuthenticationScheme, configure);
}
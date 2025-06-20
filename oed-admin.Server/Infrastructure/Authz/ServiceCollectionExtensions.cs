using oed_admin.Server.Infrastructure.DevAuth;
using oed_admin.Server.Infrastructure.EasyAuth;

namespace oed_admin.Server.Infrastructure.Authz;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAuth(
        this IServiceCollection services, 
        IWebHostEnvironment hostEnvironment, 
        IConfiguration configuration)
    {
        if (hostEnvironment.IsDevelopment())
        {
            services.AddAuthentication()
                .AddDevAuth(_ => { });

            services.AddAuthorizationBuilder()
                .AddPolicy(AuthorizationPolicies.DigitaltDodsboAdmins, builder =>
                    builder.RequireAuthenticatedUser());

            return services;
        }

        var options = new AuthOptions();
        configuration.GetSection("EasyAuth").Bind(options);

        services.AddAuthentication()
            .AddEasyAuth(_ => { });

        services.AddAuthorizationBuilder()
            .AddDigitaltDodsboPolicies(options.Groups);

        return services;
    }
}


public class AuthOptions
{
    public string[] Groups { get; set; } = [];
}
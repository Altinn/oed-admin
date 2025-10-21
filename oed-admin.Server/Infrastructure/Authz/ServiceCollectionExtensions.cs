using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
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
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.Authority = "https://login.microsoftonline.com/cd0026d8-283b-4a55-9bfa-d0ef4a8ba21c/v2.0";
                    options.Audience = "d96b3149-9c75-4bab-9826-ec5148d983af";
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateIssuerSigningKey = true,
                        ValidateLifetime = true,
                        ValidateAudience = true,
                        RequireAudience = true,
                        RequireExpirationTime = true
                    };
                });
                //.AddDevAuth(_ => { });

        //if (hostEnvironment.IsDevelopment())
        //{
        //    services.AddAuthorizationBuilder()
        //        .AddPolicy(AuthorizationPolicies.DigitaltDodsboAdmins, builder =>
        //            builder.RequireAuthenticatedUser())
        //        .AddPolicy(AuthorizationPolicies.AtLeastReadRole, builder => builder.RequireRole("Read", "Admin").RequireAuthenticatedUser())
        //        .AddPolicy(AuthorizationPolicies.RequireAdminRole, builder => builder.RequireRole("Admin").RequireAuthenticatedUser());

        //    return services;
        //}

        var options = new AuthOptions();
        //configuration.GetSection("EasyAuth").Bind(options);

        //services.AddAuthentication()
        //    .AddEasyAuth(_ => { });

        services.AddAuthorizationBuilder()
            //.AddDigitaltDodsboPolicies(options.Groups)
            .AddPolicy(AuthorizationPolicies.AtLeastReadRole, builder => builder.RequireRole("Read", "Admin").RequireAuthenticatedUser())
            .AddPolicy(AuthorizationPolicies.RequireAdminRole, builder => builder.RequireRole("Admin").RequireAuthenticatedUser());

        return services;
    }
}


public class AuthOptions
{
    public string[] Groups { get; set; } = [];
}
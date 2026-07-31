using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace oed_admin.Server.Infrastructure.Authz;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Reads the routing claims out of the bearer token WITHOUT validating it, purely so a
    /// rejection can say what the token actually carried.
    /// <para>
    /// This is necessary because IdentityModel treats audience and issuer values as PII and
    /// redacts them: on a mismatch you get a bare "IDX10214: Audience validation failed", and
    /// <c>SecurityTokenInvalidAudienceException.InvalidAudience</c> is frequently null. Without
    /// this, a misconfiguration tells you only that something did not match, not what.
    /// </para>
    /// Only application identifiers are read - never name, oid or any other personal claim.
    /// </summary>
    private static string DescribeUnvalidatedToken(HttpRequest request)
    {
        const string prefix = "Bearer ";
        var header = request.Headers.Authorization.ToString();

        if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return "(no bearer token)";
        }

        var segments = header[prefix.Length..].Split('.');
        if (segments.Length < 2)
        {
            return "(not a JWT)";
        }

        try
        {
            var payload = segments[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');

            using var document = JsonDocument.Parse(Convert.FromBase64String(payload));
            var root = document.RootElement;

            string Claim(string name) =>
                root.TryGetProperty(name, out var value) ? value.ToString() : "(absent)";

            // 'ver' distinguishes a v1 token (aud = api://<guid>) from a v2 token (aud = <guid>).
            return $"aud={Claim("aud")} iss={Claim("iss")} ver={Claim("ver")} azp={Claim("azp")} appid={Claim("appid")} roles={Claim("roles")}";
        }
        catch (Exception exception)
        {
            return $"(unparseable payload: {exception.GetType().Name})";
        }
    }

    public static IServiceCollection AddAuth(
        this IServiceCollection services,
        IWebHostEnvironment hostEnvironment,
        IConfiguration configuration)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    var clientId = configuration.GetSection("AzureEntraId:ClientId").Get<string>();
                    options.Authority = "https://login.microsoftonline.com/cd0026d8-283b-4a55-9bfa-d0ef4a8ba21c/v2.0";
                    options.Audience = clientId;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                    };

                    // Without these, a rejected token is completely invisible: the 401 body is
                    // empty, and authorization short-circuits before AuditingLoggingMiddleware so
                    // nothing reaches the audit log either. Nothing is written to the response -
                    // this is server-side diagnostics only.
                    options.Events = new JwtBearerEvents
                    {
                        OnAuthenticationFailed = context =>
                        {
                            var logger = context.HttpContext.RequestServices
                                .GetRequiredService<ILoggerFactory>()
                                .CreateLogger("oed_admin.Server.Infrastructure.Authz");

                            switch (context.Exception)
                            {
                                // An expired token is the normal end of a session, not a fault.
                                // Logged quietly so it cannot drown out real misconfiguration.
                                case SecurityTokenExpiredException expired:
                                    logger.LogInformation(
                                        "Token rejected: expired at {Expires:o}.",
                                        expired.Expires);
                                    break;

                                case SecurityTokenInvalidAudienceException:
                                    logger.LogError(
                                        "Token rejected: audience mismatch. Expected {ConfiguredAudience}. Token: {TokenClaims}. " +
                                        "ver=1 with aud=api://<guid> against a bare-guid expected audience means the app registration issues v1 tokens.",
                                        string.IsNullOrEmpty(clientId) ? "(EMPTY - AzureEntraId:ClientId is not configured)" : clientId,
                                        DescribeUnvalidatedToken(context.Request));
                                    break;

                                case SecurityTokenInvalidIssuerException:
                                    logger.LogError(
                                        "Token rejected: issuer mismatch. Expected authority {Authority}. Token: {TokenClaims}.",
                                        options.Authority,
                                        DescribeUnvalidatedToken(context.Request));
                                    break;

                                case SecurityTokenSignatureKeyNotFoundException:
                                    logger.LogError(context.Exception,
                                        "Token rejected: signing key not found. The OIDC metadata for {Authority} may be stale or unreachable.",
                                        options.Authority);
                                    break;

                                default:
                                    logger.LogError(context.Exception,
                                        "Token rejected: {ExceptionType}.",
                                        context.Exception.GetType().Name);
                                    break;
                            }

                            return Task.CompletedTask;
                        },

                        // Disambiguates the two ways a 401 happens. Without this, "no token was
                        // sent" and "a token was sent and rejected" look identical from the
                        // outside - both are a bare 401 - but they have opposite causes.
                        // Nothing is written to the response; the challenge is left untouched.
                        OnChallenge = context =>
                        {
                            if (context.AuthenticateFailure is not null)
                            {
                                // Already reported in detail by OnAuthenticationFailed.
                                return Task.CompletedTask;
                            }

                            context.HttpContext.RequestServices
                                .GetRequiredService<ILoggerFactory>()
                                .CreateLogger("oed_admin.Server.Infrastructure.Authz")
                                .LogInformation(
                                    "Request to {Path} carried no usable bearer token.",
                                    context.HttpContext.Request.Path);

                            return Task.CompletedTask;
                        },

                        // Fills the other blind spot: a role failure returns a bare 403 and, like
                        // the 401, never reaches the audit log.
                        OnForbidden = context =>
                        {
                            var logger = context.HttpContext.RequestServices
                                .GetRequiredService<ILoggerFactory>()
                                .CreateLogger("oed_admin.Server.Infrastructure.Authz");

                            logger.LogInformation(
                                "Authenticated request forbidden for {Path}. Roles on the token: {Roles}.",
                                context.HttpContext.Request.Path,
                                string.Join(", ", context.HttpContext.User
                                    .FindAll(context.HttpContext.User.Identities.First().RoleClaimType)
                                    .Select(claim => claim.Value)) is { Length: > 0 } roles
                                    ? roles
                                    : "(none)");

                            return Task.CompletedTask;
                        }
                    };
                });

        services.AddAuthorizationBuilder()
            .AddPolicy(AuthorizationPolicies.AtLeastReadRole, builder => builder.RequireRole("Read", "Admin").RequireAuthenticatedUser())
            .AddPolicy(AuthorizationPolicies.RequireAdminRole, builder => builder.RequireRole("Admin").RequireAuthenticatedUser());

        return services;
    }
}


public class AuthOptions
{
    public string[] Groups { get; set; } = [];
}
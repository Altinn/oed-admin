using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace oed_admin.Server.Infrastructure.DevAuth;

public class DevAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public DevAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock)
        : base(options, logger, encoder, clock)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        try
        {
            var principal = new ClaimsPrincipal();
            principal.AddIdentity(
                new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.Name, "Test Testesen"),
                        new Claim(ClaimTypes.NameIdentifier, "12345"),
                        new Claim(ClaimTypes.Role, "Admin")
                    ],
                    "DEV", ClaimTypes.Name, ClaimTypes.Role));

            var ticket = new AuthenticationTicket(principal, "DEV");
            var success = AuthenticateResult.Success(ticket);
            Context.User = principal;

            return Task.FromResult(success);
        }
        catch (Exception ex)
        {
            return Task.FromResult(AuthenticateResult.Fail(ex));
        }
    }
}
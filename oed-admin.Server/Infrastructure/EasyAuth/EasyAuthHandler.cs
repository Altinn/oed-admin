using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public class EasyAuthHandler : AuthenticationHandler<EasyAuthOptions>
{
    public EasyAuthHandler(
        IOptionsMonitor<EasyAuthOptions> options,
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
            var idProvider = Context.Request.Headers["X-MS-CLIENT-PRINCIPAL-IDP"].FirstOrDefault();
            var msClientPrincipal = Context.Request.Headers["X-MS-CLIENT-PRINCIPAL"].FirstOrDefault();
            
            if (string.IsNullOrWhiteSpace(msClientPrincipal)) 
                return Task.FromResult(AuthenticateResult.NoResult());

            var decodedBytes = Convert.FromBase64String(msClientPrincipal);
            var msClientPrincipalDecoded = System.Text.Encoding.Default.GetString(decodedBytes);
            var clientPrincipal = JsonSerializer.Deserialize<EasyAuthPrincipal>(msClientPrincipalDecoded);

            var principal = new ClaimsPrincipal();
            var claims = clientPrincipal.Claims.Select(x => new Claim(x.Type, x.Value));
            principal.AddIdentity(new ClaimsIdentity(claims, clientPrincipal.AuthenticationType, clientPrincipal.NameType, clientPrincipal.RoleType));

            var ticket = new AuthenticationTicket(principal, idProvider);
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
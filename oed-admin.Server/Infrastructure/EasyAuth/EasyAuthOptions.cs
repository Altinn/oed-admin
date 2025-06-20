using Microsoft.AspNetCore.Authentication;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public class EasyAuthOptions : AuthenticationSchemeOptions
{    
    public EasyAuthOptions()
    {
        Events = new object();
    }
}
using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Dbg;

public static class Endpoint
{
    public static async Task<Response> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;
        return new Response(context.User.Identity.Name);
        //return new Response(context.Request.Headers.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
    }
}

//public record Response(Dictionary<string, string> Headers);
public record Response(string Name);
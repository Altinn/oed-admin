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


public static class HeadersEndpoint
{
    public static async Task<HeadersResponse> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;
        
        return new HeadersResponse(context.Request.Headers.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
    }
}


public record HeadersResponse(Dictionary<string, string> Headers);
public record Response(string Name);
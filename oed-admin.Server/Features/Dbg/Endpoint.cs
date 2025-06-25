using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Dbg;

public static class Endpoint
{
    public static Task<Response> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;
        return Task.FromResult(new Response(context?.User?.Identity?.Name ?? string.Empty));
        //return new Response(context.Request.Headers.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
    }
}

public static class HeadersEndpoint
{
    public static Task<HeadersResponse> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;

        return Task.FromResult(
            new HeadersResponse(
                context?.Request.Headers.ToDictionary(pair =>
                    pair.Key, pair => pair.Value.ToString()) ??
                new Dictionary<string, string>()));
    }
}


public record HeadersResponse(Dictionary<string, string> Headers);
public record Response(string Name);
using System.Net.Http.Headers;

namespace oed_admin.Server.Infrastructure.DevAuth;

public class LocalTestTokenHandler : DelegatingHandler
{
    private readonly HttpClient _httpClient;

    public LocalTestTokenHandler(
        IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("orgToken");
        _httpClient.BaseAddress = new Uri(GetLocalTestTokenEndpoint());
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var scopes = "altinn:serviceowner/instances.read%20altinn:serviceowner/instances.write%20altinn:events.subscribe%20altinn:serviceowner";
        var response = await _httpClient.GetAsync($"/authentication/api/v1/orgToken?scope={scopes}&org=digdir", cancellationToken);
        var bearerToken = await response.Content.ReadAsStringAsync(cancellationToken);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);

        return await base.SendAsync(request, cancellationToken);
    }

    public static string GetLocalTestTokenEndpoint()
    {
        return Environment.GetEnvironmentVariable("LOCALTEST_TOKEN_ENDPOINT") ?? "http://localhost:5101";
    }
}
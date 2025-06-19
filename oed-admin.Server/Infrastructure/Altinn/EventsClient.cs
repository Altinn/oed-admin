namespace oed_admin.Server.Infrastructure.Altinn;

public interface IEventsClient
{
    public Task<string> GetEvents(string resource, string subject, string? after = "0");
}

public class EventsClient(HttpClient httpClient) : IEventsClient
{
    private const string BasePath = "/events/api/v1";

    public async Task<string> GetEvents(string resource, string subject, string? after = "0")
    {
        var path = $"{BasePath}/events?resource={resource}&subject={subject}&after={after}";

        var response = await httpClient.GetAsync(path);

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadAsStringAsync();

        return contentString;
    }
}

public static class EventResources
{
    public const string DodsboDomstoladminApi = "urn:altinn:resource:dodsbo-domstoladmin-api";
}
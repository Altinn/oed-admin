namespace oed_admin.Server.Infrastructure.Altinn;

public interface IFeedPollerClient
{
    /// <summary>
    /// Get a single object from the Domstol api
    /// </summary>
    public Task<object?> GetDaObject(Guid caseId);
}

public class FeedPollerClient(HttpClient httpClient) : IFeedPollerClient
{
    public async Task<object?> GetDaObject(Guid caseId)
    {
        var response = await httpClient.GetAsync(caseId.ToString());

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadFromJsonAsync<object>();

        return contentString;
    }
}
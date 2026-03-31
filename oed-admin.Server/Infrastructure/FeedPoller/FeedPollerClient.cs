namespace oed_admin.Server.Infrastructure.Altinn;

public interface IFeedPollerClient
{
    /// <summary>
    /// Get a single object from the Domstol api
    /// </summary>
    public Task<object?> GetDaObject(Guid caseId);
}

public class FeedPollerClient(HttpClient httpClient, ILogger<FeedPollerClient> logger) : IFeedPollerClient
{
    public async Task<object?> GetDaObject(Guid caseId)
    {
        logger.LogInformation("### Getting da object for case id {CaseId} ###", caseId);

        httpClient.DefaultRequestHeaders.ToList().ForEach(header => 
            logger.LogInformation("Header: {HeaderName}={HeaderValue}", header.Key, string.Join(", ", header.Value ?? [])));

        var response = await httpClient.GetAsync(caseId.ToString());

        response.EnsureSuccessStatusCode();
        var contentString = await response.Content.ReadFromJsonAsync<object>();

        return contentString;
    }
}
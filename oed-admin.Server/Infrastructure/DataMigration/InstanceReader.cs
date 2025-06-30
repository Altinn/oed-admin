using System.Web;
using Altinn.Platform.Storage.Interface.Models;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Infrastructure.DataMigration;

public class InstanceReader(IAltinnClient altinnClient)
{
    private string _continuationToken = string.Empty;

    public async IAsyncEnumerable<List<Instance>> StreamInstancesInBatches(int batchSize = 100)
    {
        while (true)
        {
            var searchResponse = await altinnClient.GetInstances(AppIds.Oed, batchSize, _continuationToken);
            yield return searchResponse.Instances;
            
            if (string.IsNullOrWhiteSpace(searchResponse.Next) ||
                !Uri.TryCreate(searchResponse.Next, UriKind.Absolute, out var uri))
            {
                break;
            }

            var queryDictionary = HttpUtility.ParseQueryString(uri.Query);
            var lastContinuationToken = queryDictionary.Get("continuationToken");

            if (!string.IsNullOrWhiteSpace(lastContinuationToken))
                _continuationToken = lastContinuationToken;
        }
    }
}
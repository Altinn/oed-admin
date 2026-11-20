using Newtonsoft.Json;

namespace oed_admin.Server.Infrastructure.Altinn;

public static class AltinnJsonSerializer
{
    public static async Task<T> Deserialize<T>(Stream contentStream)
    {
        var serializer = new JsonSerializer();

        using var sr = new StreamReader(contentStream);
        await using var jsonTextReader = new JsonTextReader(sr);
        return serializer.Deserialize<T>(jsonTextReader)!;
    }
}
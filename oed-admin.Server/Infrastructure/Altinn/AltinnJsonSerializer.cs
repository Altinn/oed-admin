using System.Xml.Serialization;
using Newtonsoft.Json;

namespace oed_testdata.Server.Infrastructure.Altinn
{
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

    public static class AltinnXmlSerializer
    {
        public static T Deserialize<T>(Stream contentStream)
        {
            var serializer = new XmlSerializer(typeof(T));
            var dataObject = serializer.Deserialize(contentStream);

            var data = (T)dataObject!;
            return data;
        }
    }
}

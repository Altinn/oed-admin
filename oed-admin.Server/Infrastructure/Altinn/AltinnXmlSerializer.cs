using System.Xml;
using System.Xml.Serialization;

namespace oed_admin.Server.Infrastructure.Altinn;

public static class AltinnXmlSerializer
{
    public static T Deserialize<T>(Stream contentStream)
    {
        var serializer = new XmlSerializer(typeof(T));

        // Refuse DTDs and external resources: no entity-expansion DoS, no XXE.
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
        using var reader = XmlReader.Create(contentStream, settings);
        var dataObject = serializer.Deserialize(reader);

        var data = (T)dataObject!;
        return data;
    }
}

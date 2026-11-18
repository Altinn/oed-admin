using Altinn.Platform.Storage.Interface.Models;

namespace oed_admin.Server.Infrastructure.OedModel;

/// <summary>
/// The Storage data element that holds an estate's OED_M: data type <c>oed</c>, stored as XML. The same rule as the
/// oed app's <c>OedDataElement</c>.
/// </summary>
public static class OedDataElement
{
    public const string DataType = "oed";
    private const string ContentType = "application/xml";

    /// <returns>The element, or null when the instance has none, including when it carries no data elements.</returns>
    public static DataElement? Find(Instance instance) =>
        instance.Data?.FirstOrDefault(element =>
            IsOedElement(element) &&
            string.Equals(element.ContentType, ContentType, StringComparison.Ordinal));

    /// <summary>Whether the element is of the <c>oed</c> data type, whatever its content type. For guards.</summary>
    public static bool IsOedElement(DataElement element) =>
        string.Equals(element.DataType, DataType, StringComparison.Ordinal);
}

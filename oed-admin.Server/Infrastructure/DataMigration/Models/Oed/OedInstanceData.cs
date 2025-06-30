#nullable disable

using Newtonsoft.Json;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using System.Xml.Serialization;

namespace oed_admin.Server.Infrastructure.DataMigration.Models.Oed;

[XmlRoot(ElementName = "oed")]
public class OedInstanceData
{
    [XmlElement("CaseId")]
    [JsonProperty("caseId")]
    [JsonPropertyName("caseId")]
    public string CaseId { get; set; }

    [XmlElement("CaseNumber")]
    [JsonProperty("caseNumber")]
    [JsonPropertyName("caseNumber")]
    public string CaseNumber { get; set; }

    [XmlElement("DeceasedInfo")]
    [JsonProperty("deceasedInfo")]
    [JsonPropertyName("deceasedInfo")]
    public DeceasedInfo DeceasedInfo { get; set; }

    [XmlElement("Heirs")]
    [JsonProperty("heirs")]
    [JsonPropertyName("heirs")]
    public List<HeirInfo> Heirs { get; set; }

    [XmlElement("StatusNotifications")]
    [JsonProperty("statusNotifications")]
    [JsonPropertyName("statusNotifications")]
    public List<StatusNotification> StatusNotifications { get; set; }

    [XmlElement("MarriagePactsFromRegister")]
    [JsonProperty("marriagePactsFromRegister")]
    [JsonPropertyName("marriagePactsFromRegister")]
    public string MarriagePactsFromRegister { get; set; }

    [XmlElement("PropertyRights")]
    [JsonProperty("propertyRights")]
    [JsonPropertyName("propertyRights")]
    public string PropertyRights { get; set; }

    [XmlElement("ProbateDeadline")]
    [JsonProperty("probateDeadline")]
    [JsonPropertyName("probateDeadline")]
    public string ProbateDeadline { get; set; }

    [XmlElement("DistrictCourtName")]
    [JsonProperty("districtCourtName")]
    [JsonPropertyName("districtCourtName")]
    public string DistrictCourtName { get; set; }

    [XmlElement("ProbateResult")]
    [JsonProperty("probateResult")]
    [JsonPropertyName("probateResult")]
    public ProbateResult ProbateResult { get; set; }

    [XmlElement("CaseStatus")]
    [JsonProperty("caseStatus")]
    [JsonPropertyName("caseStatus")]
    public string CaseStatus { get; set; }

    [XmlElement("Version")]
    [JsonProperty("version")]
    [JsonPropertyName("version")]
    public string Version { get; set; }

    [XmlElement("EstateRevoked")]
    [JsonProperty("estateRevoked")]
    [JsonPropertyName("estateRevoked")]
    public bool? EstateRevoked { get; set; }

    [XmlElement("MyTaxUri")]
    [JsonProperty("myTaxUri")]
    [JsonPropertyName("myTaxUri")]
    public string MyTaxUri { get; set; }

    [XmlElement("FirstHeirReceivedDate")]
    [JsonProperty("firstHeirReceivedDate")]
    [JsonPropertyName("firstHeirReceivedDate")]
    public DateTimeOffset? FirstHeirReceivedDate { get; set; }
}

public class ProbateResult
{
    [XmlElement("Result")]
    [JsonProperty("result")]
    [JsonPropertyName("result")]
    public string Result { get; set; }

    [XmlElement("Heirs")]
    [JsonProperty("heirs")]
    [JsonPropertyName("heirs")]
    public List<string> Heirs { get; set; }

    [XmlElement("AcceptsDebtHeirs")]
    [JsonProperty("acceptsDebtHeirs")]
    [JsonPropertyName("acceptsDebtHeirs")]
    public List<string> AcceptsDebtHeirs { get; set; }

    [XmlElement("Received")]
    [JsonProperty("received")]
    [JsonPropertyName("received")]
    public string Received { get; set; }
}

public class DeceasedInfo
{
    [XmlElement("Deceased")]
    [JsonProperty("deceased")]
    [JsonPropertyName("deceased")]
    public Person Deceased { get; set; }

    [XmlElement("DateOfDeath")]
    [JsonProperty("dateOfDeath")]
    [JsonPropertyName("dateOfDeath")]
    public string DateOfDeath { get; set; }

    [XmlElement("MaritalStatus")]
    [JsonProperty("maritalStatus")]
    [JsonPropertyName("maritalStatus")]
    public int MaritalStatus { get; set; }

    [XmlElement("ContactPerson")]
    [JsonProperty("contactPerson")]
    [JsonPropertyName("contactPerson")]
    public Person ContactPerson { get; set; }
}

public class Person
{
    [Range(int.MinValue, int.MaxValue)]
    [XmlElement("UserId")]
    [JsonProperty("userid")]
    [JsonPropertyName("userid")]
    public int? UserId { get; set; }

    [Range(int.MinValue, int.MaxValue)]
    [XmlElement("PartyId")]
    [JsonProperty("partyId")]
    [JsonPropertyName("partyId")]
    public int PartyId { get; set; }

    [XmlElement("Birthday")]
    [JsonProperty("birthday")]
    [JsonPropertyName("birthday")]
    public string Birthday { get; set; }

    [XmlElement("Nin")]
    [JsonProperty("nin")]
    [JsonPropertyName("nin")]
    public string Nin { get; set; }

    [XmlElement("FirstName")]
    [JsonProperty("firstName")]
    [JsonPropertyName("firstName")]
    public string FirstName { get; set; }

    [XmlElement("MiddleName")]
    [JsonProperty("middleName")]
    [JsonPropertyName("middleName")]
    public string MiddleName { get; set; }

    [XmlElement("LastName")]
    [JsonProperty("lastName")]
    [JsonPropertyName("lastName")]
    public string LastName { get; set; }

    [XmlElement("Address")]
    [JsonProperty("address")]
    [JsonPropertyName("address")]
    public Address Address { get; set; }

    [XmlElement("Role")]
    [JsonProperty("role")]
    [JsonPropertyName("role")]
    public string Role { get; set; }
}

public class Address
{
    [XmlElement("StreetAddress")]
    [JsonProperty("streetAddress")]
    [JsonPropertyName("streetAddress")]
    public string StreetAddress { get; set; }

    [XmlElement("PostalCode")]
    [JsonProperty("postalCode")]
    [JsonPropertyName("postalCode")]
    public string PostalCode { get; set; }

    [XmlElement("City")]
    [JsonProperty("city")]
    [JsonPropertyName("city")]
    public string City { get; set; }
}

public class HeirInfo
{
    [XmlElement("Heir")]
    [JsonProperty("heir")]
    [JsonPropertyName("heir")]
    public Person Heir { get; set; }

    [XmlElement("CorrespondenceReceived")]
    [JsonProperty("correspondenceReceived")]
    [JsonPropertyName("correspondenceReceived")]
    public bool EstateReadyCorrespondenceSent { get; set; }

    [XmlElement("EstateReadyCorrespondenceTaskId")]
    [JsonProperty("estateReadyCorrespondenceTaskId")]
    [JsonPropertyName("estateReadyCorrespondenceTaskId")]
    public string EstateReadyCorrespondenceTaskId { get; set; }

    [XmlElement("Waiver60DayPeriod")]
    [JsonProperty("waiver60DayPeriod")]
    [JsonPropertyName("waiver60DayPeriod")]
    public bool Waiver60DayPeriod { get; set; }

    [XmlElement("WillingToAssumeDebt")]
    [JsonProperty("willingToAssumeDebt")]
    [JsonPropertyName("willingToAssumeDebt")]
    public bool WillingToAssumeDebt { get; set; }

    [XmlElement("SignedDate")]
    [JsonProperty("signedDate")]
    [JsonPropertyName("signedDate")]
    public DateTimeOffset? SignedDate { get; set; }

    [XmlElement("PreferredSettlementProcedure")]
    [JsonProperty("preferredSettlementProcedure")]
    [JsonPropertyName("preferredSettlementProcedure")]
    public string PreferredSettlementProcedure { get; set; }

    [XmlElement("ProbateIssuedCorrespondenceSent")]
    [JsonProperty("probateIssuedCorrespondenceSent")]
    [JsonPropertyName("probateIssuedCorrespondenceSent")]
    public bool ProbateIssuedCorrespondenceSent { get; set; }
}

public enum StatusNotificationType
{
    OpenApp
}

public class StatusNotification
{
    public int PartyID { get; set; }
    public DateTime Timestamp { get; set; }
    public StatusNotificationType StatusNotificationType { get; set; }
}
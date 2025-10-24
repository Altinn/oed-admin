using System.Text.Json.Serialization;

namespace oed_admin.Server.Features.Estate.MinimalSearch;

public class MinimalEstateDto
{
    public required string DeceasedName { get; set; }
    public string? CaseNumber { get; set; }
    public string? DistrictCourtName { get; set; }
    public string? CaseStatus { get; set; }
    public DateTimeOffset? Scheduled { get; set; }
    public List<MinimalPerson> Heirs { get; set; } = [];

    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? ProbateDeadline { get; set; }
    public DateTimeOffset? FirstHeirReceived { get; set; }
    public DateTimeOffset? DelarationCreated { get; set; }
    public DateTimeOffset? DeclarationSubmitted { get; set; }
    public DateTimeOffset? ProbateIssued { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public EstateStatus Status
    {
        get
        {
            if (ProbateIssued is not null) return EstateStatus.ProbateIssued;
            if (DeclarationSubmitted is not null) return EstateStatus.DeclarationSubmitted;
            if (DelarationCreated is not null) return EstateStatus.DeclarationCreated;
            if (FirstHeirReceived is not null) return EstateStatus.FirstHeirReceived;

            return EstateStatus.Created;
        }
    }
}

public readonly record struct MinimalPerson(string Birthdate);

public enum EstateStatus
{
    Unknown = 0,
    Created,
    FirstHeirReceived,
    DeclarationCreated,
    DeclarationSubmitted,
    ProbateIssued,
}

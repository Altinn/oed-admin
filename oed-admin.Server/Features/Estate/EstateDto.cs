using System.Text.Json.Serialization;

namespace oed_admin.Server.Features.Estate;


public class EstateDto
{
    public Guid Id { get; set; }
    public required string DeceasedNin { get; set; }
    public int DeceasedPartyId { get; set; }
    public required string DeceasedName { get; set; }
    public DateOnly DateOfDeath { get; set; }
    public required string InstanceId { get; set; }
    public string? DeclarationInstanceId { get; set; }

    public string? CaseId { get; set; }
    public string? CaseNumber { get; set; }
    public string? CaseStatus { get; set; }
    public string? DistrictCourtName { get; set; }

    public string? ProbateResult { get; set; }

    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? ProbateDeadline { get; set; }
    public DateTimeOffset? FirstHeirReceived { get; set; }
    public DateTimeOffset? DelarationCreated { get; set; }
    public DateTimeOffset? DeclarationSubmitted { get; set; }
    public DateTimeOffset? ProbateIssued { get; set; }

    public DateTimeOffset? AccessDate { get; set; }
    public bool? IsCancelled { get; set; }


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

public enum EstateStatus
{
    Unknown = 0,
    Created,
    FirstHeirReceived,
    DeclarationCreated,
    DeclarationSubmitted,
    ProbateIssued,
}
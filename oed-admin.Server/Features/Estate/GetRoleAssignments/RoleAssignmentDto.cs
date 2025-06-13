namespace oed_admin.Server.Features.Estate.GetRoleAssignments;

public class RoleAssignmentDto
{
    public long Id { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public string EstateSsn { get; set; } = string.Empty;
    public string? HeirSsn { get; set; }
    public string RecipientSsn { get; set; } = string.Empty;
    public DateTimeOffset Created { get; set; }
    public string? Justification { get; set; }
}
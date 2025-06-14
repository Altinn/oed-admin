﻿namespace oed_admin.Server.Features.Estate.GetRoleAssignmentLog;

public class RoleAssignmentLogDto
{
    public long Id { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public string EstateSsn { get; set; } = string.Empty;
    public string? HeirSsn { get; set; }
    public string RecipientSsn { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTimeOffset Timestamp { get; set; }
    public string? Justification { get; set; }
}
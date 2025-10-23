namespace oed_admin.Server.Infrastructure.Auditing;


public record UserDetails(string Id, string Name, string[] Roles);
public record EstateDetails(string Id);

public record RequestDetails(string TraceId, string Path, string QueryString, string Body);

public record ResponseDetails(int StatusCode);

public record AuditLogRecord(
    UserDetails User,
    RequestDetails Request, 
    ResponseDetails Response,
    EstateDetails[]? Estates = null);
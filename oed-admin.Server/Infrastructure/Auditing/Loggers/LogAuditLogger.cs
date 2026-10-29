namespace oed_admin.Server.Infrastructure.Auditing.Loggers;

public class LogAuditLogger(ILogger<LogAuditLogger> logger) : IAuditLogger
{
    public Task LogAsync(AuditLogRecord logRecord)
    {
        var estateIds = logRecord.Estates is not null 
            ? logRecord.Estates.Select(e => e.Id)
            : [];

        logger.LogWarning("### AUDIT LOG RECORD ###\n\tUser: [{UserId} | {UserName} | {UserRoles}] \n\tEstate(s): [{EstateId}] \n\tRequest: [{TraceIdentifier} | {Path} | {Query} | {Body}] \n\tResponse: [{StatusCode}]",
            logRecord.User.Id,
            logRecord.User.Name,
            string.Join(", ", logRecord.User.Roles),
            string.Join(",\n\t\t ", estateIds),
            logRecord.Request.TraceId,
            logRecord.Request.Path,
            logRecord.Request.QueryString,
            logRecord.Request.Body,
            logRecord.Response.StatusCode);

        return Task.CompletedTask;
    }
}
namespace oed_admin.Server.Infrastructure.Auditing.Loggers;

public interface IAuditLogger
{
    public Task LogAsync(AuditLogRecord logRecord);
}
namespace oed_admin.Server.Infrastructure.Auditing.Loggers;

public class NullLogger : IAuditLogger
{
    public Task LogAsync(AuditLogRecord logRecord)
    {
        return Task.CompletedTask;
    }
}
namespace oed_admin.Server.Infrastructure.Auditing.Loggers;

public class AzureTableAuditLogger : IAuditLogger
{
    public Task LogAsync(AuditLogRecord logRecord)
    {
        throw new NotImplementedException();
    }
}
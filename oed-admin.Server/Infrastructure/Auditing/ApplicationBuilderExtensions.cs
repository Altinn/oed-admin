namespace oed_admin.Server.Infrastructure.Auditing;

public static class ApplicationBuilderExtensions
{
    public static IApplicationBuilder UseAuditLogging(
        this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AuditingLoggingMiddleware>();
    }
}
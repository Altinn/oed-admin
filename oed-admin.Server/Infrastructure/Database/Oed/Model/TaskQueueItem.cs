using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace oed_admin.Server.Infrastructure.Database.Oed.Model;

public class TaskQueueItem
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public string? JsonPayload { get; set; }
    public required DateTimeOffset Created { get; set; }
    public DateTimeOffset? Scheduled { get; set; }
    public DateTimeOffset? Executed { get; set; }
    public DateTimeOffset? LastAttempt { get; set; }
    public string? LastError { get; set; }
    public int Attempts { get; set; }
    public string? EstateSsn { get; set; }
}

public class TaskQueueItemConfiguration : IEntityTypeConfiguration<TaskQueueItem>
{
    public void Configure(EntityTypeBuilder<TaskQueueItem> builder)
    {
        builder.ToTable("task_queue");
        builder.HasKey(task => task.Id);

        builder.Property(item => item.JsonPayload)
            .HasColumnType("jsonb");

        builder.Property(item => item.EstateSsn)
            .HasMaxLength(11)
            .IsRequired(false);
    }
}
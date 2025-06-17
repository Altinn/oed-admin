using System.Reflection.Metadata.Ecma335;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Filters;

namespace oed_admin.Server.Features.Estate.GetTasks;

public class TaskDto
{
    public Guid Id { get; set; }
    public string Type { get; set; }
    public string JsonPayload { get; set; }
    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? Scheduled { get; set; }
    public DateTimeOffset? Executed { get; set; }
    public DateTimeOffset? LastAttempt { get; set; }
    public string LastError { get; set; }
    public int Attempts { get; set; }
    public string EstateSsn { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public TaskStatus Status
    {
        get
        {
            if (Scheduled is null) return TaskStatus.DeadLetterQueue;
            if (Executed is not null) return TaskStatus.Executed;
            return Attempts switch
            {
                0 => TaskStatus.Scheduled,
                > 0 and < 10 => TaskStatus.Retrying,
                >= 10 => TaskStatus.DeadLetterQueue,
                _ => TaskStatus.Unknown
            };
        }
    }
    
}

public enum TaskStatus
{
    Unknown = 0,
    Scheduled,
    Executed,
    Retrying,
    DeadLetterQueue,
}
namespace oed_admin.Server.Features.Tasks.GetTasks;

public class Request
{
    public int? Page { get; set; } = 1;
    public int? PageSize { get; set; } = 10;
    public string? Status { get; set; }


    public bool IsValid()
    {
        if (Page is not null and not > 0)
        {
            return false;
        }

        if (PageSize is not null and not > 0)
        {
            return false;
        }

        if (Status is not null)
        {
            if (StatusAsEnum() is null)
                return false;
        }

        return true;
    }

    public TaskStatus? StatusAsEnum()
    {
        if (Enum.TryParse(typeof(TaskStatus), Status, out var statusAsEnum))
            return statusAsEnum as TaskStatus?;
        
        return null;
    }
}
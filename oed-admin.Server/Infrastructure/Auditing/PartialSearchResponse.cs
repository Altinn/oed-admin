namespace oed_admin.Server.Infrastructure.Auditing;

public class PartialEstate
{
    public string Id { get; set; }
}

public class PartialSearchResponse
{
    public List<PartialEstate> Estates { get; set; } = [];
    public PartialEstate? Estate { get; set; } = null;
}
namespace oed_admin.Server.Features.Estate.Search;

public readonly record struct Response(int Page, int PageSize, List<EstateDto> Estates);

namespace oed_admin.Server.Features.Estate.SearchOpenDeclarations;

/// <summary>
/// Same shape as the estate search response. The audit middleware reads the estate ids from
/// <see cref="Estates"/>, so the property name must stay.
/// </summary>
public readonly record struct Response(int Page, int PageSize, List<EstateDto> Estates);

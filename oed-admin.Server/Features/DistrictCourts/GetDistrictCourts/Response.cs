using oed_admin.Server.Features.Tasks;

namespace oed_admin.Server.Features.DistrictCourts.GetDistrictCourts;

public record Response(List<DistrictCourtSummaryDto> ConnectedDistrictCourts);
using Altinn.Dd.Correspondence.Features.Search;
using Altinn.Dd.Correspondence.Models;
using Altinn.Dd.Correspondence.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GetCorrespondences;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IDdCorrespondenceService ddCorrespondenceService)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.BadRequest();

        var query = new Query(
            ResourceId: "oed-correspondence", 
            Role: CorrespondencesRoleType.Sender, 
            SendersReference: estate.InstanceId);
        var searchResult = await ddCorrespondenceService.Search(query);
        if (searchResult.IsSuccess)
        {
            var correspondencesTasks = new List<Task<Altinn.Dd.Correspondence.Features.Get.Result>>();
            foreach (var correspondenceId in searchResult.Value!)
            {
                var getRequest = new Altinn.Dd.Correspondence.Features.Get.Request(correspondenceId);
                correspondencesTasks.Add(ddCorrespondenceService.Get(getRequest));
            }
            await Task.WhenAll(correspondencesTasks);
            return TypedResults.Ok(new Response([.. correspondencesTasks.Select(t => t.Result.Value!)]));
        }
        else
        {
            return TypedResults.BadRequest();
        }
    }

}

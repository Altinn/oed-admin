using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Features.Estate;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.SecretExpiry.Get
{
    public class Response
    {      

        public static async Task<List<KvSecret>> GetSecrets()
        {
            return new List<KvSecret>();
        }
    }
}

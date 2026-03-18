using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;

namespace oed_admin.Server.Features.Estate;

public static class OedInstanceExtensions
{
    extension(HeirV2 heir)
    {
        public bool HasPowerOfAttorney()
        {
            // 1. For the PersonHeirV2 a CourtRole should be set and we use this to determine if the heir has power of attorney.
            // 2. Before PersonHeirV2 var instroduced, no court role was set since only heirs with a "formuesfullmakt" was received from DA.
            // Old versions of the instances will contain PersonHeir instead of PersonHeirV2 and for these we have to assume that they DO have the "formuesfullmakt" role and return true.
            // 3. For all the rest, return false

            return heir switch
            {
                null => false,
                PersonHeirV2 personHeirV2 => personHeirV2.CourtRole?.StartsWith("urn:domstolene:digitaltdodsbo:") ?? false,
                PersonHeir => true,
                _ => false
            };
        }
    }
    extension(HeirInfo heirInfo)
    {
        public HeirV2 GetHeir() =>
            heirInfo.HeirV2 ??
            heirInfo.Heir ??
            throw new ArgumentNullException(nameof(heirInfo.Heir));

        public T OfType<T>() where T : class => 
            (heirInfo.GetHeir() as T)!;

        public bool HasPowerOfAttorney() =>
            heirInfo.GetHeir() is PersonHeir personHeir &&
            personHeir.HasPowerOfAttorney();

        public bool IsPerson() => heirInfo.GetHeir() is PersonHeir;
    }

    extension(IEnumerable<HeirInfo> heirInfos)
    {
        public IEnumerable<HeirInfo> PeopleWithPowerOfAttorney() =>
            heirInfos.Where(h => h.IsPerson() && h.HasPowerOfAttorney());
    }
}
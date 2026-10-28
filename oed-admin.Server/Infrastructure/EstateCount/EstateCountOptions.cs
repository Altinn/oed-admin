namespace oed_admin.Server.Infrastructure.EstateCount;

public record OptionValue(string Value, string Label);

/// <summary>
/// The case statuses a count can filter on, and the labels for the heir roles a count can be
/// grouped by. The client renders these and StartCount validates case statuses against them.
/// </summary>
public static class EstateCountOptions
{
    /// <summary>Selects estates whose CaseStatus is null - DA has not sent a case yet.</summary>
    public const string NoStatus = "NONE";

    private const string HeirRolePrefix = "urn:digitaltdodsbo:arving:";

    // The statuses DA sends, from the status enum in oed-events' Domstol.Hendelser external_api.yaml.
    public static readonly IReadOnlyList<OptionValue> CaseStatuses =
    [
        new("MOTTATT", "Mottatt"),
        new("FERDIGBEHANDLET", "Ferdigbehandlet"),
        new("FEILFORT", "Feilført"),
        new("OVERFORT_ANNEN_DOMSTOL", "Overført annen domstol"),
        new(NoStatus, "Ingen status")
    ];

    // Mirrors CloudEventMapper.MapRelation in digdir/oed-events, which writes HeirV2.Role on the
    // OED_M instance. Keep in step with it; ukjentRelasjon is its fallback. Only used for labels -
    // a role found on an instance that is missing here is still counted, under its raw value.
    public static readonly IReadOnlyList<OptionValue> HeirRoles =
    [
        HeirRole("partAnnen", "Part, annen"),
        HeirRole("gjenlevEktefellePartner", "Gjenlevende ektefelle/partner"),
        HeirRole("gjenlevPartner", "Gjenlevende partner"),
        HeirRole("gjenlevSamboer", "Gjenlevende samboer"),
        HeirRole("gjenlevEktefelle", "Gjenlevende ektefelle"),
        HeirRole("barn", "Barn"),
        HeirRole("barnebarn", "Barnebarn"),
        HeirRole("barnebarnsBarn", "Barnebarns barn"),
        HeirRole("saerkullsbarn", "Særkullsbarn"),
        HeirRole("saerkullsbarnBarn", "Særkullsbarns barn"),
        HeirRole("far", "Far"),
        HeirRole("mor", "Mor"),
        HeirRole("soesken", "Søsken"),
        HeirRole("soeskensBarn", "Søskens barn"),
        HeirRole("soeskensBarnebarn", "Søskens barnebarn"),
        HeirRole("soeskensBarnebarnsBarn", "Søskens barnebarns barn"),
        HeirRole("halvSoesken", "Halvsøsken"),
        HeirRole("halvSoeskensBarn", "Halvsøskens barn"),
        HeirRole("halvSoeskensBarnebarn", "Halvsøskens barnebarn"),
        HeirRole("farfar", "Farfar"),
        HeirRole("farmor", "Farmor"),
        HeirRole("morfar", "Morfar"),
        HeirRole("mormor", "Mormor"),
        HeirRole("onkel", "Onkel"),
        HeirRole("tante", "Tante"),
        HeirRole("fetter", "Fetter"),
        HeirRole("kusine", "Kusine"),
        HeirRole("staten", "Staten"),
        HeirRole("avdoede", "Avdøde"),
        HeirRole("avdoedeEktefellePartner", "Avdødes ektefelle/partner"),
        HeirRole("fordringshaver", "Fordringshaver"),
        HeirRole("verge", "Verge"),
        HeirRole("foreldrevergeAktoer", "Foreldreverge"),
        HeirRole("midlertidigvergeAktoer", "Midlertidig verge"),
        HeirRole("fullmektig", "Fullmektig"),
        HeirRole("prosfull", "Prosessfullmektig"),
        HeirRole("fremtidsfullmektig", "Fremtidsfullmektig"),
        HeirRole("mottakerFullmaktDoedsboLitenVerdi", "Mottaker av fullmakt (dødsbo av liten verdi)"),
        HeirRole("testArvingFull", "Testamentarving (full)"),
        HeirRole("testArvingBegr", "Testamentarving (begrenset)"),
        HeirRole("ukjentRelasjon", "Ukjent relasjon")
    ];

    private static readonly HashSet<string> CaseStatusValues =
        CaseStatuses.Select(option => option.Value).ToHashSet(StringComparer.Ordinal);

    public static bool IsValidCaseStatus(string value) => CaseStatusValues.Contains(value);

    private static OptionValue HeirRole(string suffix, string label) => new($"{HeirRolePrefix}{suffix}", label);
}

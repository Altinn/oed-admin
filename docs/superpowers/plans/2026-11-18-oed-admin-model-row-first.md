# oed-admin reads the model row first (Altinn/oed#1903) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** oed-admin reads an estate's OED_M from `oed.estate_model` when the estate has a row, and from Storage only when it doesn't, so nothing in oed-admin ever reads a migrated estate's frozen Storage copy.

**Architecture:** A read-only `EstateModel` entity on oed-admin's `OedDbContext`, with a `SaveChanges` guard that refuses writes to it. `OedModelJson` holds options copied from oed. One scoped row-first reader, `IOedModelSource`, is used by estate search and estate count. The raw data proxy refuses a migrated estate's `oed` element. The Storage → `estate` backfill is removed. A new xUnit project tests all of this against a real Postgres (`jsonb`) through Testcontainers.

**Tech Stack:** .NET 10, EF Core 10 + Npgsql 10 (snake_case convention), System.Text.Json, xUnit 2.9.3, Testcontainers.PostgreSql 4.14.0.

**Spec:** `docs/superpowers/specs/2026-11-18-oed-admin-model-row-first-design.md` (a copy of Altinn/oed#1903, plus two planning decisions at its end).

**oed reference clone:** `C:\Sourcecode\digdir\oed` at `b6efb99b`. Paths below marked *oed:* are in that clone.

## Global Constraints

- **Never add an EF Core migration** (CLAUDE.md). `oed.estate_model` is owned by oed. Tests create the schema with `EnsureCreatedAsync()` from oed-admin's own model.
- oed-admin **never writes `estate_model`** and never writes the `oed` element in Storage (spec §1.4).
- **A row is the estate's only truth.** Once a row exists, never fall back to Storage, including when the row can't be deserialized or belongs to another party (spec §2.2.1; *oed:* `RoutingOedModelReader` remarks).
- No phase setting, flag or configuration in oed-admin (spec §1.2).
- The `oed` element is found by `DataType == "oed"` and `ContentType == "application/xml"`, never by position (spec §2.2.2).
- Table `estate_model`, schema `oed`. Columns: `instance_guid` (PK, uuid), `instance_owner_party_id` (int), `estate_id` (uuid, unique), `model` (jsonb). Copied from *oed:* `App/Infrastructure/OedModel/EstateModelTable.cs`.
- JSON options are copied verbatim from *oed:* `App/Infrastructure/OedModel/OedModelJson.cs` `CreateOptions()`. Never guess them (spec §2.1).
- Every DB read uses `.AsNoTracking()` (CLAUDE.md).
- Endpoints keep their routes, policies and response shapes. The audit middleware is unchanged (CLAUDE.md, "Audit logging").
- `packages.lock.json` is committed for every project (`Directory.Build.props`).

## Review Focus

1. **The row's JSON can't be deserialized** (corrupt row, or a type mismatch with oed's shape). Expected: the call throws and nothing falls back to Storage. Search returns 500. Count records the estate as `InvalidData`. Test: Task 2 `Get_RowWithInvalidJson_ThrowsAndDoesNotReadStorage` and Task 4 `CheckEstate_InvalidRowJson_IsInvalidData`.
2. **The row's `instance_owner_party_id` differs from the party in `Estate.InstanceId`.** Expected: no model, and no Storage read. Test: Task 2 `Get_RowOfOtherParty_ReturnsPartyMismatchWithoutStorage`.
3. **jsonb reorders keys, so `type` is no longer first in a heir.** Expected: subtypes survive. Only a real `jsonb` column proves this. Test: Task 2 `Get_RowFromJsonb_KeepsHeirSubtypes` inserts the snapshot through SQL into `jsonb` and reads it back.
4. **An instance whose first data element is not `oed`** (for example `dataTypeChecklists`). Expected: the `oed` element is read. Test: Task 2 `Get_NoRow_ReadsOedElementByDataTypeNotPosition`.
5. **Someone adds an `EstateModel` to the context and saves.** Expected: `SaveChanges` throws before any SQL runs. Test: Task 1 `SaveChanges_WithAddedEstateModel_Throws`.

---

## File Structure

**New test project: `oed-admin.Server.Tests/`**
- `oed-admin.Server.Tests.csproj`: xUnit, Testcontainers.PostgreSql, references `oed-admin.Server`.
- `PostgresFixture.cs`: one container per test run (`ICollectionFixture`). `CreateDbContext()`, and `EnsureCreatedAsync()` once.
- `FakeAltinnClient.cs`: an in-memory `IAltinnClient` that records calls.
- `TestData/oed_model_storage_contract.json`: copied from *oed:* `ApiTest/ContractSnapshots/oed_model_storage_contract.json`.
- `OedModel/OedModelJsonContractTests.cs`, `OedModel/EstateModelGuardTests.cs`, `OedModel/OedModelSourceTests.cs`
- `Features/MinimalSearchTests.cs`, `Features/GetInstanceDataTests.cs`
- `EstateCount/EstateCountCheckTests.cs`

**Server, new: `oed-admin.Server/Infrastructure/OedModel/`**
- `EstateModel.cs`: the entity and its `IEntityTypeConfiguration`.
- `OedModelJson.cs`: options and `Deserialize`.
- `OedDataElement.cs`: `Find(Instance)` and `IsOedElement(DataElement)`.
- `IOedModelSource.cs`: the interface and the result types.
- `OedModelSource.cs`: the row-first reader.
- `ServiceCollectionExtensions.cs`: `AddOedModelSource()`.

**Server, modified**
- `Infrastructure/Database/Oed/OedDbContext.cs`: `DbSet<EstateModel>` and the write guard.
- `Infrastructure/Database/Oed/Model/Estate.cs`: unique index on `InstanceId` (mirrors oed's `estate_instance_id_idx`; affects only `EnsureCreated`).
- `Features/Estate/MinimalSearch/Endpoint.cs`, `Infrastructure/EstateCount/EstateCountService.cs`, `Features/Instances/GetInstanceData/Endpoint.cs`, `Program.cs`, `Features/Endpoints.cs`.
- `oed-admin.Server.csproj`: `InternalsVisibleTo`.

**Removed (decision in the spec):** `Infrastructure/DataMigration/{InstanceToDbDataMigration,InstanceReader,ServiceCollectionExtensions,WebApplicationExtensions}.cs`, `Features/Maintenance/DataMigration/`, `oed-admin.client/src/components/dataMigration/`, and its route in `App.tsx`. `Infrastructure/DataMigration/Models/` **stays**, because search and count use `OedInstanceData`.

**Other:** `oed-admin.sln`, `QaTests/SonarGateTests.cs` (coverage), `CLAUDE.md`.

---

### Task 1: Test project, read-only `EstateModel`, `OedModelJson`, snapshot test

**Files:**
- Create: the test project files above except the `Features/`, `EstateCount/` and `OedModelSourceTests` tests. Create `OedModel/EstateModel.cs`, `OedModel/OedModelJson.cs`.
- Modify: `oed-admin.sln`, `OedDbContext.cs`, `Estate.cs`, `oed-admin.Server.csproj`

**Interfaces:**
- Produces:
  - `public sealed class EstateModel { Guid InstanceGuid; int InstanceOwnerPartyId; Guid EstateId; string Model; }` with `init` setters, in namespace `oed_admin.Server.Infrastructure.OedModel`.
  - `public static class EstateModelTable { const Schema = "oed", Name = "estate_model"; static class Columns { InstanceGuid, InstanceOwnerPartyId, EstateId, Model } }`.
  - `OedDbContext.EstateModel : DbSet<EstateModel>`.
  - `public static class OedModelJson { JsonSerializerOptions Options; OedInstanceData Deserialize(string json); }`. `Deserialize` throws `JsonException` on the literal `null`.
  - Tests: `PostgresFixture.CreateDbContext() : OedDbContext`, `[Collection(PostgresCollection.Name)]`, and `PostgresFixture.InsertEstateWithModel(Guid instanceGuid, int partyId, string modelJson) : Task<Guid estateId>`, which inserts the `estate` row through EF and the `estate_model` row through `ExecuteSqlInterpolatedAsync` with `{json}::jsonb`.

- [ ] **Step 1: Create the test project.** `dotnet new xunit -n oed-admin.Server.Tests -f net10.0`, then `dotnet sln add`. Packages: `xunit` 2.9.3, `xunit.runner.visualstudio` 4.0.1, `Microsoft.NET.Test.Sdk` 18.12.0 (as in `QaTests.csproj`), `Testcontainers.PostgreSql` 4.14.0. Add a `ProjectReference` to the server project. `ImplicitUsings` and `Nullable` are on. Add `<InternalsVisibleTo Include="oed-admin.Server.Tests" />` to the server csproj. Copy the snapshot JSON into `TestData/` with `CopyToOutputDirectory=PreserveNewest`. Then `dotnet restore` to create `packages.lock.json`.

- [ ] **Step 2: Write the failing tests**

`OedModelJsonContractTests` (no database). The class comment says where the JSON comes from (*oed:* `ApiTest/ContractSnapshots/oed_model_storage_contract.json` at `b6efb99b`) and that it must be re-copied when oed changes the snapshot.

```csharp
[Fact] void Snapshot_Deserializes_WithAllHeirSubtypes()
// var m = OedModelJson.Deserialize(File.ReadAllText("TestData/oed_model_storage_contract.json"));
// m.CaseNumber == "26-000123TVA-OSLO"; m.DeceasedInfo.Deceased.Nin == "01015012345"
// m.Heirs.Select(h => h.HeirV2?.GetType()) ==
//   [typeof(PersonHeirV2), typeof(PersonHeir), typeof(OrganizationHeir), typeof(PappPersonHeir), typeof(PappOrganizationHeir), null]
//   (read the heir order from the snapshot file; the last entry is the legacy `heir`)
// ((PersonHeirV2)m.Heirs[0].HeirV2).CourtRole == "urn:domstolene:digitaltdodsbo:formuesfullmakt"
// m.Heirs[^1].Heir.PartyId == 50033333
// m.StatusNotifications[0].StatusNotificationType == StatusNotificationType.OpenApp
// m.FirstHeirReceivedDate == DateTimeOffset.Parse("2026-01-05T12:00:00+02:00")

[Fact] void Snapshot_WithTypeNotFirst_StillDeserializes()
// Move "type" last in every heirV2 object (JsonNode rewrite), deserialize, same subtype assertions.

[Fact] void Deserialize_JsonNull_Throws()  // Assert.Throws<JsonException>(() => OedModelJson.Deserialize("null"))
```

`EstateModelGuardTests` (Postgres):

```csharp
[Fact] Task SaveChanges_WithAddedEstateModel_Throws()
// ctx.EstateModel.Add(new EstateModel{...}); await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
// then, in a fresh context: (await ctx2.EstateModel.CountAsync()) unchanged
[Fact] Task SaveChanges_WithModifiedOrDeletedEstateModel_Throws()   // attach a fixture row, Update/Remove, the same assertion
[Fact] Task SaveChanges_WithOtherEntities_Succeeds()                 // an Estate insert still works
```

- [ ] **Step 3: Run them and see them fail**

Run: `dotnet test oed-admin.Server.Tests`
Expected: a compile failure (`EstateModel`, `OedModelJson` are missing).

- [ ] **Step 4: Implement**
  - `EstateModel` + `EstateModelConfiguration`: `ToTable(Name, Schema)`, `HasKey(InstanceGuid)`, explicit `HasColumnName` from the constants, `Model` with `HasColumnType("jsonb")`, `HasIndex(EstateId).IsUnique()`. No FK, no `xmin`, no timestamp columns (YAGNI; oed-admin reads only these four). The class comment says: owned by oed (*oed:* `EstateModelTable`), read-only, never `Add`/`Update`/`Remove`, and oed's `OedModelWriteGuardTests` can't see this repo, so `OedDbContext` guards it.
  - `OedDbContext`: add the `DbSet`. Override `SaveChanges(bool)` and `SaveChangesAsync(bool, CancellationToken)`: if `ChangeTracker.Entries<EstateModel>()` has any entry that is `Added`, `Modified` or `Deleted`, throw `InvalidOperationException("oed.estate_model is owned by the oed app; oed-admin must never write it")`.
  - `Estate.cs`: `builder.HasIndex(e => e.InstanceId, "estate_instance_id_idx").IsUnique()` (as *oed:* `EstateConfiguration`; affects only `EnsureCreated`).
  - `OedModelJson`: `CreateOptions()` copied verbatim from oed, with its comments, deserializing as `OedInstanceData`. Add a header comment naming the source file and commit.

- [ ] **Step 5: Run and see them pass.** `dotnet test oed-admin.Server.Tests`. Expected: all green.

- [ ] **Step 6: Make it fail once.** Comment out `AllowOutOfOrderMetadataProperties = true` and see `Snapshot_WithTypeNotFirst_StillDeserializes` go red. Restore it.

- [ ] **Step 7: Commit.** `git commit -m "Add read-only EstateModel and OedModelJson, with a test project"`

---

### Task 2: `IOedModelSource`, the row-first reader

**Files:**
- Create: `OedModel/OedDataElement.cs`, `OedModel/IOedModelSource.cs`, `OedModel/OedModelSource.cs`, `OedModel/ServiceCollectionExtensions.cs`, `Tests/FakeAltinnClient.cs`, `Tests/OedModel/OedModelSourceTests.cs`
- Modify: `Program.cs` (`builder.Services.AddOedModelSource();` after `AddOedDatabase`)

**Interfaces:**
- Consumes: `EstateModel`, `OedModelJson.Deserialize` (Task 1).
- Produces:

```csharp
public enum OedModelOrigin { Database, Storage }
public enum OedModelMissing { NoInstance, NoDataElement, PartyMismatch }
public readonly record struct OedModelResult(OedInstanceData? Model, OedModelOrigin? Origin, OedModelMissing? Missing)
{
    public static OedModelResult Found(OedInstanceData model, OedModelOrigin origin);
    public static OedModelResult NotFound(OedModelMissing missing);
}
public interface IOedModelSource
{
    Task<OedModelResult> Get(int instanceOwnerPartyId, Guid instanceGuid, CancellationToken cancellationToken = default);
}
public static class OedDataElement
{
    public const string DataType = "oed";
    public static DataElement? Find(Instance instance);       // DataType == "oed" && ContentType == "application/xml", ordinal
    public static bool IsOedElement(DataElement element);     // DataType only, for guards
}
// Registered scoped: services.AddScoped<IOedModelSource, OedModelSource>()
```

`FakeAltinnClient : IAltinnClient` implements `GetInstance` and `GetInstanceData<T>` from dictionaries (`Instances[(party, guid)]`, `Data[dataGuid]` holding an `OedInstanceData`). It counts calls in `GetInstanceCalls` and `GetInstanceDataCalls`, and can be set to throw `HttpRequestException` with a given status. Every other member throws `NotSupportedException`.

- [ ] **Step 1: Write the failing tests** (`[Collection(PostgresCollection.Name)]`, a new instance guid per test)

```csharp
Get_RowAndStorageBothExist_ReturnsRowAndNeverCallsStorage
// row with CaseNumber "FROM-ROW"; fake Storage instance+element with CaseNumber "FROM-STORAGE"
// result.Origin == Database; Model.CaseNumber == "FROM-ROW"; fake.GetInstanceCalls == 0
Get_RowFromJsonb_KeepsHeirSubtypes
// insert the snapshot via fixture (jsonb reorders keys) -> heirs' types as in Task 1
Get_NoRow_ReadsStorage                       // Origin == Storage, Model.CaseNumber == "FROM-STORAGE"
Get_NoRow_ReadsOedElementByDataTypeNotPosition
// instance.Data = [ {DataType "dataTypeChecklists", Id g1}, {DataType "oed", ContentType "application/xml", Id g2} ]
// fake.Data has only g2 -> found; and fake records the dataGuid it was asked for == g2
Get_NoRowNoInstance_ReturnsNoInstance        // Missing == NoInstance, Model null
Get_NoRowNoOedElement_ReturnsNoDataElement   // only a "ref-data-as-pdf" element
Get_RowOfOtherParty_ReturnsPartyMismatchWithoutStorage   // Missing == PartyMismatch, GetInstanceCalls == 0
Get_RowWithInvalidJson_ThrowsAndDoesNotReadStorage
// row model '{"heirs":[{"heirV2":{"type":"Nope"}}]}' -> ThrowsAsync<JsonException>; GetInstanceCalls == 0
```

- [ ] **Step 2: Run them and see them fail** (compile error: `IOedModelSource` is missing).

- [ ] **Step 3: Implement `OedModelSource(OedDbContext db, IAltinnClient storage, ILogger<OedModelSource> logger)`**
  1. One query by PK: `db.EstateModel.AsNoTracking().Where(m => m.InstanceGuid == g).Select(m => new { m.InstanceOwnerPartyId, m.Model }).SingleOrDefaultAsync(ct)`.
  2. If a row exists: on a party mismatch, log a warning (ids only) and return `PartyMismatch`. Otherwise return `Found(OedModelJson.Deserialize(row.Model), Database)`. Never touch Storage.
  3. If there is no row: `GetInstance` → `NoInstance` if null. `OedDataElement.Find` → `NoDataElement` if null or the id isn't a guid. Else `GetInstanceData<OedInstanceData>` → `Found(…, Storage)`.
  4. Log `"OED model of instance {InstanceGuid} read from {Origin}"` at Information. Spec §6 verifies from this line. Log no personal data.
  5. Exceptions from Storage (`HttpRequestException`, the XML `InvalidOperationException`) and from JSON propagate. Callers classify them.

- [ ] **Step 4: Run and see them pass.** `dotnet test oed-admin.Server.Tests --filter OedModelSourceTests`

- [ ] **Step 5: Make each fail once** (spec §5)
  - Swap the order so Storage is tried first, and see `Get_RowAndStorageBothExist_…` go red.
  - Replace `OedDataElement.Find` with `instance.Data.FirstOrDefault()`, and see `…ByDataTypeNotPosition` go red.
  - Restore both.

- [ ] **Step 6: Commit.** `git commit -m "Add the row-first OED model reader"`

---

### Task 3: Estate search through the reader

**Files:**
- Modify: `Features/Estate/MinimalSearch/Endpoint.cs`
- Test: `oed-admin.Server.Tests/Features/MinimalSearchTests.cs`

**Interfaces:**
- Consumes: `IOedModelSource.Get` (Task 2).
- Produces: `Endpoint.Post([FromBody] Request, [FromServices] OedDbContext, [FromServices] IOedModelSource)`. The `IAltinnClient` parameter goes away. The route and the `Response` are unchanged.

- [ ] **Step 1: Write the failing tests.** Call `Endpoint.Post` directly with a fixture context and an `OedModelSource` over a `FakeAltinnClient`. Use a nin unique to each test.

```csharp
Post_EstateWithRow_HeirsComeFromRow
// Estate(nin, InstanceId "{party}/{guid}") + row whose heirs = [PersonHeirV2 CourtRole formuesfullmakt Birthday "1980-02-03",
//   PersonHeirV2 CourtRole null Birthday "1990-01-01"]; Storage element says Birthday "1111-11-11"
// Ok<Response>.Value.Estate.Heirs == [ new MinimalPerson("1980-02-03") ]; fake.GetInstanceCalls == 0
Post_EstateWithoutRow_HeirsComeFromStorageOedElement
// Data = [checklists element first, oed element second] -> heirs from the oed element
Post_TwoEstatesSameNin_UsesNewestByCreated   // only the newer estate's row has a PoA heir
Post_NoInstanceAndNoRow_ReturnsEmptyResponse // Value.Estate is null, as today
```

- [ ] **Step 2: Run them and see them fail** (wrong parameter list).

- [ ] **Step 3: Implement.** Keep the nin lookup (newest by `Created`) and the `InstanceId` parsing. Replace the GetInstance/`Data.FirstOrDefault()`/GetInstanceData block with `source.Get(...)`. Keep today's response mapping: a missing model (any `Missing`) → `new Response()`, as today's "no instance/no element" paths. Build the DTO and `Scheduled` as now. Heirs come from `result.Model`.

- [ ] **Step 4: Run and see them pass.** `dotnet test oed-admin.Server.Tests --filter MinimalSearchTests`

- [ ] **Step 5: Commit.** `git commit -m "Read the estate search's model row first"`

---

### Task 4: Estate count through the reader

**Files:**
- Modify: `Infrastructure/EstateCount/EstateCountService.cs`
- Test: `oed-admin.Server.Tests/EstateCount/EstateCountCheckTests.cs`

**Interfaces:**
- Consumes: `IOedModelSource` (Task 2).
- Produces: `internal static Task<CheckResult> CheckEstate(IOedModelSource source, EstateRow row, CancellationToken ct)`. `EstateRow` and `CheckResult` become `internal`. Failure reasons stay `InvalidInstanceId`, `NoOedInstance`, `NoDataElement`, `InvalidData`, `StorageError`. `PartyMismatch` maps to `NoOedInstance` with detail `"PartyMismatch"`.

- [ ] **Step 1: Write the failing tests**

```csharp
CheckEstate_WithRow_RolesFromRowWithoutStorage   // row roles ["barn","testamentsarving"]; Storage says ["ektefelle"]; GetInstanceCalls == 0
CheckEstate_WithoutRow_RolesFromStorage
CheckEstate_InvalidRowJson_IsInvalidData         // FailureReason == "InvalidData"
CheckEstate_RowOfOtherParty_IsNoOedInstance      // FailureReason == "NoOedInstance", Detail == "PartyMismatch"
```

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**
  - `CheckEstate` parses `InstanceId` as now, calls `source.Get`, and maps `Missing` to the reasons above. Catch `InvalidOperationException` (XML) **and `JsonException`** (row) → `InvalidData`.
  - `RunCount` no longer resolves `IAltinnClient`. `DbContext` isn't thread-safe and the loop runs four estates in parallel, so each estate gets its own scope: in the `Parallel.ForEachAsync` body, `await using var scope = scopeFactory.CreateAsyncScope()` and resolve `IOedModelSource` there. The pooled `OedDbContext` keeps this cheap. `CheckEstateWithRetry` takes the source instead of the client. The 401/403 and transient handling is unchanged.
  - Rewrite the class summary and the "Same data element rule as InstanceToDbDataMigration" comment, since that class goes away in Task 6. Don't add the optional single SQL query for the database part (spec §2.2 "may"). A PK lookup per estate is negligible next to Storage.

- [ ] **Step 4: Run and see them pass.** `dotnet test oed-admin.Server.Tests --filter EstateCountCheckTests`

- [ ] **Step 5: Commit.** `git commit -m "Read the estate count's model row first"`

---

### Task 5: Raw data proxy refuses a migrated estate's `oed` element

**Files:**
- Modify: `Features/Instances/GetInstanceData/Endpoint.cs`
- Test: `oed-admin.Server.Tests/Features/GetInstanceDataTests.cs`

**Interfaces:**
- Consumes: `OedDbContext.EstateModel`, `OedDataElement.IsOedElement` (Tasks 1–2).
- Produces: `Endpoint.Get([AsParameters] Request, [FromServices] OedDbContext, [FromServices] IAltinnClient)`. Same route.

- [ ] **Step 1: Write the failing tests.** `FakeAltinnClient.GetInstanceDataAsBytes` returns fixed bytes and counts calls.

```csharp
Get_OedElementOfInstanceWithRow_Returns404WithoutReadingData   // NotFound; GetInstanceDataAsBytesCalls == 0
Get_OtherElementOfInstanceWithRow_ReturnsFile                  // e.g. "declaration-pdf" on the same instance
Get_InstanceWithoutRow_ReturnsFileWithoutGetInstance           // receipts: GetInstanceCalls == 0
```

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement.** If `EstateModel.AsNoTracking().AnyAsync(m => m.InstanceGuid == request.InstanceGuid)`: fetch the instance. If the element with `Id == request.DataGuid` satisfies `OedDataElement.IsOedElement`, return `TypedResults.NotFound()`, with a comment citing #1884 rule 1. Otherwise proxy as today.

- [ ] **Step 4: Run and see them pass.**

- [ ] **Step 5: Commit.** `git commit -m "Stop the data proxy from serving a migrated estate's frozen oed element"`

---

### Task 6: Remove the Storage → estate backfill

**Files:**
- Delete: `Infrastructure/DataMigration/InstanceToDbDataMigration.cs`, `InstanceReader.cs`, `ServiceCollectionExtensions.cs`, `WebApplicationExtensions.cs`, the `Features/Maintenance/DataMigration/` folder, and `oed-admin.client/src/components/dataMigration/`
- Modify: `Features/Endpoints.cs` (remove the `/datamigration` route), `oed-admin.client/src/App.tsx` (remove the import and route), `CLAUDE.md` ("Data migration" section: replace it with one line saying the backfill was removed in #1903 because oed's copier backfills `Estate` rows)

- [ ] **Step 1: Delete and unwire.** Look for any SPA nav link to `/maintenance/datamigration` (`grep -rn "datamigration" oed-admin.client/src`). Expected: none left.
- [ ] **Step 2: Verify.** `dotnet build` succeeds. `grep -rn "InstanceToDbDataMigration\|DataMigrationTrigger\|InstanceReader" oed-admin.Server --include=*.cs` finds nothing outside `obj/`. From `oed-admin.client/`, run `npm ci && npm run build && npm run lint`, all green.
- [ ] **Step 3: Commit.** `git commit -m "Remove the unregistered Storage-to-estate backfill"`

---

### Task 7: Coverage in the Sonar gate, full verification, review

**Files:**
- Modify: `QaTests/SonarGateTests.cs`, `CLAUDE.md` ("Tests" section)

- [ ] **Step 1: Wire coverage.** Add `Coverage = new() { TestCsprojRelativePath = "oed-admin.Server.Tests/oed-admin.Server.Tests.csproj", Excludes = ["[xunit.*]*", "[oed-admin.Server.Tests]*"] }`. Replace the "No coverage step" comment. In `CLAUDE.md`, replace "There is no unit test project" with the new project: it needs Docker (Testcontainers), and plain `dotnet test` runs it in CI.
- [ ] **Step 2: Full run.** `dotnet build` and `dotnet test` from the repo root. Expected: all of `oed-admin.Server.Tests` passes, and QaTests is skipped.
- [ ] **Step 3: §2.4, no writes.** `grep -rnE "PutAsync|PostAsync|PatchAsync|SendAsync|HttpMethod\." oed-admin.Server --include=*.cs`. Expected: only `OedClient` and `OedSystemAdminClient` (oed endpoints) and `AltinnClient.DeleteEventSubscription`. Nothing writes `/data/`. Record the result for the issue comment (Step 6).
- [ ] **Step 4: §4, search again.** Run `gh search code --owner Altinn "OED_M"`, `gh search code --owner Altinn "OedInstanceData"`, `gh search code --owner Altinn '"dataType" "oed"'` and `gh search code --owner Altinn '"/data/" oed'`. List each hit per repo, read or write, and check it against the repos in spec §4. These searches don't cover the Studio Gitea repos (oed itself and its sub-apps). Say so.
- [ ] **Step 5: Reviews.** Run the `security-reviewer` and `sonar-preflight` agents on the branch diff. Fix CONFIRMED findings and re-run.
- [ ] **Step 6: Draft the issue comment** for Altinn/oed#1903, in Norwegian like earlier status comments: what was done, the §2.4 result, the §4 search result, both planning decisions, and the open deploy/verify steps (§6). **Show it to the user; post it only after they approve.**
- [ ] **Step 7: Commit.** `git commit -m "Wire the new test project into the Sonar gate's coverage"`

**After the plan (manual, not for an agent):** deploy to TT02 before #1904's first admin copy, then do the §6 verification (search the e2e estate before and after the copy and check the "read from Database" log line), then prod before the canary.

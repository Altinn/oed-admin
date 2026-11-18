# Spec: oed-admin reads the model row first (Altinn/oed#1903)

> Copied from https://github.com/Altinn/oed/issues/1903 on 2026-11-18. The issue is the source of truth; this copy travels with the plan. Decisions taken while planning are under **Planning decisions** at the end.


**Parent:** #1884 ("Andre repoer", and #1892 §7–8)
**Depends on:** 3a #1899 (table and stored JSON shape). It can be built in parallel with 3b–3e. **It must be deployed to an environment before the first row is created there**: in TT02 that is 3c's first admin copy (#1904 §10), in prod the canary (step 5).
**Date:** 2026-11-10. File references are from `main` of each repo on this date.

## 1. Goal

After this change:

1. Nothing outside the oed app reads a migrated estate's frozen `oed` element from Storage.
2. oed-admin's estate search, estate counts and Storage → `estate` backfill read the model from `oed.estate_model` when the estate has a row, and from Storage only when it doesn't. This is the same rule as oed's routing reader (3c), so it is right in every phase without a setting.
3. ~~oed-testdata-app's `GET /api/oed/instance/{estateSsn}/data` is either gone (if nothing uses it), or no longer reads Storage.~~ Moved to #1924.
4. Neither repo writes `estate_model`, or writes `OED_M` to Storage (rule 1 in #1884).
5. A fresh search of every related repo confirms nothing else reads or writes the element.

## 2. oed-admin (`Altinn/oed-admin`)

oed-admin already has its own `OedDbContext` over the `oed` database (`oed-admin.Server/Infrastructure/Database/Oed/OedDbContext.cs`, with `Estate` and `TaskQueue`). It reads `OED_M` from Storage, with its own copy of the model (`Infrastructure/DataMigration/Models/Oed/OedInstanceData.cs`), in three places:

| Where | What it does today | Change |
|---|---|---|
| `Features/Estate/MinimalSearch/Endpoint.cs` | Finds the newest `Estate` by nin, GETs the instance, takes **`instance.Data.FirstOrDefault()`** (any element, not necessarily `oed`, an existing bug), and reads it as `OedInstanceData` to find the heirs with power of attorney | Read through the row-first reader (§2.2) |
| `Infrastructure/EstateCount/EstateCountService.cs` (~261–276) | For each estate that matches the filters, GETs the instance and its `oed` element | Read through the row-first reader. For estates with a row, the filter can become one SQL query over `estate_model`. |
| `Infrastructure/DataMigration/InstanceToDbDataMigration.cs` | Backfills or updates (with `updateExisting`) `Estate` rows from Storage instances and their `OED_M` | Read through the row-first reader, so a migrated estate's `Estate` row is never overwritten with values from the frozen copy |

### 2.1 Reading the model row

- Add a read-only `EstateModel` entity to oed-admin's `OedDbContext`, mapped to `oed.estate_model` with the column names from 3a. Always use `.AsNoTracking()`. oed-admin must never write the table, and oed's `OedModelWriteGuardTests` can't see another repo. So say so in a comment on the entity, and never call `Add`, `Update` or `Remove` on it.
- Deserialize `model` into `OedInstanceData` with options that read what oed's `OedModelJson` writes. In particular, set `AllowOutOfOrderMetadataProperties = true`: `jsonb` reorders keys, so the `type` discriminator of `HeirV2`/`ProbateHeir` is no longer first (3a §3).
  - Copy oed's options rather than guessing. The stored shape is pinned by oed's snapshot `ApiTest/ContractSnapshots/oed_model_storage_contract.json`.
  - Add a test in oed-admin that deserializes that snapshot's JSON into `OedInstanceData` and checks that the heirs' subtypes survive. Copy the JSON in, with a note on where it comes from.
- Read `estate_model` directly, not the reporting views: oed-admin needs birth dates and party ids, which the views deliberately leave out (3a §5).

### 2.2 One row-first reader

Put the rule in one place in oed-admin, e.g. `IOedModelSource.Get(instanceOwnerPartyId, instanceGuid)`, and route all three callers through it:

1. Look up the row by instance guid. If it exists, return it, and never fall back to Storage for an estate with a row.
2. Otherwise, read the instance's `oed` element from Storage as today: the element whose `DataType` is `oed`, not `Data.FirstOrDefault()`. Fix the bug while you're there.
3. Neither found: return null, as today's "no data".

No phase setting is needed. The rule is correct before, during and after the migration. Once phase `Database` is reached, step 2 simply never finds anything that a row doesn't already cover. Step 6 removes the fallback.

- Search by nin: `MinimalSearch` takes the newest `Estate` by `Created` (TT02 has several per nin). Keep that, then read by `Estate.InstanceId`.
- Counts: for performance, the builder may answer the database part with one query and look up only the remaining estates in Storage. The rule stays the same.

### 2.3 The backfill

`InstanceToDbDataMigration` is a `BackgroundService` that reads every oed instance's `OED_M` and creates or updates `Estate` rows. With the row-first reader it reads the current model for migrated estates too, so it stays correct. Check that it doesn't create an `Estate` row that conflicts with the one oed's copy (3c) creates: both key on `InstanceId`, which is unique. If oed-admin's insert loses the race, it must re-read and update instead of failing the run. If the team no longer needs the backfill, removing it is also fine: oed's copy backfills missing `Estate` rows for the move.

### 2.4 No writes to Storage

Check that oed-admin never writes the `oed` element in Storage (no `PUT` on `…/data/{id}` for it). If it does anywhere, that write must go through an oed endpoint instead, because it would break rule 1 for a migrated estate. Record the result here.

## 3. oed-testdata-app (`Altinn/oed-testdata-app`)

Moved to **#1924** (3f-2) on 2026-11-17, with the same content. It is a gate of its own: no row in an environment before both this issue and #1924 are out there.

## 4. Search again

The repos checked for #1884 and #1892 were oed-authz, oed-declaration, dd-private-probate, oed-events, EstateExplorer, dd-e2e-test, oed-admin and oed-testdata-app. Before step 4, search every `Altinn` repo the team owns once more, e.g. with `gh search code --owner Altinn "OED_M"`, `"oed" "/data/"`, `OedInstanceData` and `"dataType" "oed"`, for both reads and writes. Record the result here. Anything new that touches the element gets the same treatment as §2 and #1924.

## 5. Tests

- oed-admin:
  - The snapshot deserialization test (§2.1).
  - The row-first reader against a test database: a row wins over Storage when both exist, Storage is used when there is no row, and the element is found by `DataType`, not by position.
  - Search, count and backfill go through the row-first reader.
  - **Make each fail once:** let Storage win and see the "row wins" test go red; restore `FirstOrDefault()` and see the element test go red.
- oed-testdata-app: see #1924.

## 6. Verification

- **TT02, before 3c's first admin copy:** deploy oed-admin. Search for the e2e estate's deceased: the result is the same as before (it comes from Storage).
- **After the copy:** search again. The result now comes from the row (log or metric), and it matches what the oed frontend shows. Make a change in the estate through the frontend and search once more: the change shows.
- Step 4 repeats this for migrated estates in bulk, and compares an estate count before and after the sweep.
- The testdata endpoint: see #1924.

## 7. Done when

- [ ] oed-admin: read-only `EstateModel`, one row-first reader used by search, counts and backfill, snapshot deserialization test
- [ ] oed-admin: `FirstOrDefault()` bug fixed; no writes to the `oed` element (checked and recorded)
- [ ] oed-admin deployed to TT02 before the first row exists there, and to prod before the canary
- [ ] ~~oed-testdata-app: `…/data` endpoint removed, or reading through oed~~ Moved to #1924.
- [ ] Fresh search of the team's repos recorded here; nothing else reads or writes the element
- [ ] Verified in TT02 (§6)



## Planning decisions (2026-11-18)

- **§2.3, the backfill: removed.** `InstanceToDbDataMigration` was never registered in `Program.cs` (its endpoint already failed at request time), and oed's copier backfills missing `Estate` rows. Removed with its endpoint, route, DI extension, `InstanceReader`, the unused `MapDataMigrationEndpoints` and the SPA page.
- **Not in the spec: the raw data proxy.** `GET /api/instances/{p}/{g}/data/{dataGuid}` proxies any Storage data element. The SPA only uses it for sub-app receipts, but by hand it could serve a migrated estate's frozen `oed` element (goal 1). It now answers 404 for an `oed` element of an instance with an `estate_model` row.

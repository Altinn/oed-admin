---
name: new-endpoint
description: Scaffold a new vertical-slice endpoint in oed-admin.Server following the Features/<Area>/<Operation>/ convention, and register it in Features/Endpoints.cs with an authorization policy. Use when adding an API route to the admin backend.
---

# Adding an endpoint to oed-admin.Server

Endpoints here are vertical slices. There is no service or repository layer: the handler injects
`OedDbContext` / `AuthzDbContext` / a typed Altinn client with `[FromServices]` and does the work.

Ask for the **area**, **operation**, and **HTTP verb** if the user has not given them. Area is an
existing folder under `Features/` (`Estate`, `Tasks`, `Instances`, `Superadmin`, `EventSubscriptions`,
`Maintenance`, `DistrictCourts`) or a new one.

## Steps

**1. Create `oed-admin.Server/Features/<Area>/<Operation>/`** with `Endpoint.cs`, `Request.cs`, and
`Response.cs`. See `references/endpoint-template.cs` for the exact shape. Rules that matter:

- `Endpoint` is a **static class** with a single static method named after the verb (`Get`, `Post`,
  `Patch`, `Delete`) returning `Task<IResult>`.
- Bind route/query params with `[AsParameters] Request request`; bind a JSON body with
  `[FromBody] Request request`.
- **First line of the handler** is the validation guard:
  `if (!request.IsValid()) return TypedResults.BadRequest();`
- `Request` is a `record` with a hand-rolled `IsValid()`. Compare GUIDs against `Guid.Empty`, never
  `default`.
- Read queries use `.AsNoTracking()`. This app is read-mostly against databases owned by other
  services — **never add an EF Core migration here.**
- Map entity → DTO with `PoorMansMapper.Map<TFrom, TTo>(entity)`. It copies name-matching properties
  by reflection, so only give the DTO the properties you intend to expose.
- A "not found" result is usually `TypedResults.Ok(new Response(null))`, not a 404 — match the
  neighbouring slices in the same area.

**2. Register the route in `oed-admin.Server/Features/Endpoints.cs`.** The endpoint does not exist
until you do this — nothing fails at build time, the route is simply absent.

Add it to the matching `Map<Area>Endpoints()` extension method inside the `extension(WebApplication app)`
block, or as a top-level `app.MapX(...)` if the area has no group.

**3. Attach an authorization policy.** Group registrations already carry
`.RequireAuthorization(AuthorizationPolicies.RequireAdminRole)`, so a route added to an existing group
inherits it. A new top-level route needs its own:

- `AuthorizationPolicies.RequireAdminRole` — the default. Use unless told otherwise.
- `AuthorizationPolicies.AtLeastReadRole` — only for read-only lookups that expose **no** identifying
  personal data (no `DeceasedNin`, `DeceasedName`, `DeceasedPartyId`, date of death).

Never add an unauthenticated route. `GET /api/qa` is the sole intentional exception and it stays that way.

**4. Check the audit trail.** `AuditingLoggingMiddleware` extracts affected estate ids from the
`{estateId}` route value, or — for POST — by deserializing the response as `PartialSearchResponse`
(an `Estate` object, or an `Estates` array of items with `Id`).

If the new endpoint returns estate data but has neither, the audit record will have no estate ids.
Either add `{estateId:guid}` to the route, shape the response to match, or raise it with the user.
Do not quietly ship an unaudited personal-data lookup.

**5. Client side, if asked.** Add a query-key factory and hook under `oed-admin.client/src/queries/`,
following `taskQueries.ts`. Fetch through `fetchWithMsal` from `utils/msalUtils.ts` — never bare
`fetch`, which would send the request without a bearer token.

## Verify

```
dotnet build oed-admin.Server/oed-admin.Server.csproj
```

Then confirm the route appears: run the server and check the Scalar UI at `/scalar` (Development and
Staging only), or grep `Features/Endpoints.cs` for the new symbol.

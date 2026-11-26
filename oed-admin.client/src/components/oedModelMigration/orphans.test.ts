import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAllRunItems,
  isOrphanCandidate,
  orphanKind,
  orphanDeleteEnabled,
  softDeleteOrphan,
  stopsTheLoop,
  type MigrationRun,
  type OrphanSoftDeleteResult,
  type RunItem,
} from "./api";
import { fetchWithMsal } from "../../utils/msalUtils";

vi.mock("../../utils/msalUtils", () => ({ fetchWithMsal: vi.fn() }));
const fetchMock = vi.mocked(fetchWithMsal);

const runId = "11111111-1111-1111-1111-111111111111";

const item = (n: number, failure: string | null = "NoDeceasedInfo", outcome: string | null = "Failed"): RunItem => ({
  run: {
    instanceGuid: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    instanceOwnerPartyId: 50000000 + n,
    outcome,
    failure,
    reason: null,
    droppedElements: [],
    storageLastChanged: null,
    attempts: 1,
    updated: "2026-11-25T10:17:45+00:00",
  },
  estateId: null,
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const result = (status: number, outcome: string | null = null): OrphanSoftDeleteResult => ({
  status,
  result: outcome ? { outcome, reason: null, created: null, lastChanged: null } : null,
  problem: null,
  retryAfterSeconds: null,
});

const run = (mode: string): MigrationRun => ({ mode } as MigrationRun);

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe("softDeleteOrphan", () => {
  it("posts to oed-admin's soft-delete-orphan route and returns its answer", async () => {
    fetchMock.mockResolvedValueOnce(json(result(200, "SoftDeleted")));

    const answer = await softDeleteOrphan(50005681, "4eb31f0e-2bed-49e9-91a6-ccf47962f784");

    expect(answer.result?.outcome).toBe("SoftDeleted");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/maintenance/oedmodel/estates/50005681/4eb31f0e-2bed-49e9-91a6-ccf47962f784/soft-delete-orphan",
      { method: "POST" },
    );
  });
});

describe("getAllRunItems", () => {
  it("follows the pages until one is short", async () => {
    const first = Array.from({ length: 100 }, (_, i) => item(i + 1));
    const second = Array.from({ length: 24 }, (_, i) => item(i + 101));
    fetchMock
      .mockResolvedValueOnce(json({ status: 200, items: first, page: 1, pageSize: 100, total: 124, problem: null }))
      .mockResolvedValueOnce(json({ status: 200, items: second, page: 2, pageSize: 100, total: 124, problem: null }));

    const items = await getAllRunItems(runId, "Failed");

    expect(items).toHaveLength(124);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=2");
    expect(String(fetchMock.mock.calls[1][0])).toContain("outcome=Failed");
  });

  it("throws when oed doesn't answer a page, rather than returning a short list", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 502, items: null, page: null, pageSize: null, total: null, problem: null }));

    await expect(getAllRunItems(runId, "Failed")).rejects.toThrow();
  });
});

describe("stopsTheLoop", () => {
  it.each([0, 401, 403, 409])("stops on %i: every following call would fail the same way", (status) => {
    expect(stopsTheLoop(result(status))).toBe(true);
  });

  it.each([200, 404, 502, 503])("carries on after %i: it belongs to one estate", (status) => {
    expect(stopsTheLoop(result(status))).toBe(false);
  });
});

describe("isOrphanCandidate", () => {
  it("is a sweep run's Failed item with NoDeceasedInfo", () => {
    expect(isOrphanCandidate(run("Sweep"), item(1))).toBe(true);
  });

  it("is not a verify run's item", () => {
    expect(isOrphanCandidate(run("Verify"), item(1))).toBe(false);
  });

  it("is not a Failed item with another failure", () => {
    expect(isOrphanCandidate(run("Sweep"), item(1, "RoundTrip"))).toBe(false);
  });
});

describe("orphanKind", () => {
  it.each([
    ["staging", "noDeceasedInfo"],
    ["production", null],
  ])("is noDeceasedInfo for a sweep run's Failed/NoDeceasedInfo item only in TT02 (%s)", (environment, kind) => {
    vi.stubEnv("VITE_ENVIRONMENT", environment);
    expect(orphanKind(run("Sweep"), item(1))).toBe(kind);
  });

  it.each(["staging", "production"])("is empty for a verify run's Broken item in any environment (%s)", (environment) => {
    vi.stubEnv("VITE_ENVIRONMENT", environment);
    expect(orphanKind(run("Verify"), item(1, null, "Broken"))).toBe("empty");
  });

  it.each(["staging", "production"])("is nothing for a sweep item that says Broken (%s)", (environment) => {
    vi.stubEnv("VITE_ENVIRONMENT", environment);
    expect(orphanKind(run("Sweep"), item(1, null, "Broken"))).toBeNull();
  });

  it.each(["staging", "production"])("is nothing for a verify run's Missing item (%s)", (environment) => {
    vi.stubEnv("VITE_ENVIRONMENT", environment);
    expect(orphanKind(run("Verify"), item(1, null, "Missing"))).toBeNull();
  });
});

describe("orphanDeleteEnabled", () => {
  it("is true only against TT02 (VITE_ENVIRONMENT staging)", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "staging");
    expect(orphanDeleteEnabled()).toBe(true);
    vi.stubEnv("VITE_ENVIRONMENT", "production");
    expect(orphanDeleteEnabled()).toBe(false);
    vi.stubEnv("VITE_ENVIRONMENT", "");
    expect(orphanDeleteEnabled()).toBe(false);
  });
});

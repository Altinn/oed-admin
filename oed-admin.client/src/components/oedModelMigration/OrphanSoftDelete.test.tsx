import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { OrphanBulkDelete, OrphanRowDelete } from "./OrphanSoftDelete";
import RunItems from "./RunItems";
import type { MigrationRun, OrphanSoftDeleteResult, RunItem } from "./api";
import * as api from "./api";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, softDeleteOrphan: vi.fn(), getAllRunItems: vi.fn(), getRunItems: vi.fn() };
});
const softDelete = vi.mocked(api.softDeleteOrphan);
const allItems = vi.mocked(api.getAllRunItems);
const runItems = vi.mocked(api.getRunItems);

const sweep = { id: "11111111-1111-1111-1111-111111111111", mode: "Sweep", status: "Completed", report: null } as MigrationRun;
const verify = { ...sweep, mode: "Verify" } as MigrationRun;

const item = (n: number, failure = "NoDeceasedInfo"): RunItem => ({
  run: {
    instanceGuid: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    instanceOwnerPartyId: 50000000 + n,
    outcome: "Failed",
    failure,
    reason: null,
    droppedElements: [],
    storageLastChanged: null,
    attempts: 1,
    updated: "2026-11-25T10:17:45+00:00",
  },
  estateId: null,
});

const answer = (status: number, outcome: string | null, reason: string | null = null): OrphanSoftDeleteResult => ({
  status,
  result: outcome ? { outcome, reason, created: null, lastChanged: null } : null,
  problem: null,
  retryAfterSeconds: null,
});

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const startBulk = async () => {
  await userEvent.click(screen.getByRole("button", { name: /Slett alle NoDeceasedInfo-dødsbo/ }));
  return screen.findByRole("alertdialog");
};

beforeEach(() => {
  vi.stubEnv("VITE_ENVIRONMENT", "staging");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("where the buttons show", () => {
  it("shows nothing outside TT02", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "production");
    wrap(
      <>
        <OrphanBulkDelete run={sweep} />
        <OrphanRowDelete run={sweep} item={item(1)} />
      </>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing for a verify run", () => {
    wrap(
      <>
        <OrphanBulkDelete run={verify} />
        <OrphanRowDelete run={verify} item={item(1)} />
      </>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no row button on a Failed item with another failure", () => {
    wrap(<OrphanRowDelete run={sweep} item={item(1, "RoundTrip")} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is wired into a sweep run's item table, on the NoDeceasedInfo rows only", async () => {
    runItems.mockResolvedValue({ status: 200, items: [item(1), item(2, "RoundTrip")], page: 1, pageSize: 100, total: 2, problem: null });

    wrap(<RunItems run={sweep} onCopyInstance={() => {}} />);

    expect(await screen.findAllByRole("button", { name: /^Slett …/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Slett alle NoDeceasedInfo-dødsbo/ })).toBeTruthy();
  });
});

describe("one row", () => {
  it("confirms, sends one call and shows oed's answer", async () => {
    softDelete.mockResolvedValue(answer(200, "NotAnOrphan", "hasModelRow"));
    wrap(<OrphanRowDelete run={sweep} item={item(1)} />);

    await userEvent.click(screen.getByRole("button", { name: /^Slett …/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/50000001\/00000000-0000-0000-0000-000000000001/)).toBeTruthy();
    expect(softDelete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Ja, slett" }));

    expect(await screen.findByText(/hasModelRow/)).toBeTruthy();
    expect(softDelete).toHaveBeenCalledTimes(1);
    expect(softDelete).toHaveBeenCalledWith(50000001, "00000000-0000-0000-0000-000000000001");
  });
});

describe("all of a run's NoDeceasedInfo items", () => {
  const candidates = Array.from({ length: 124 }, (_, i) => item(i + 1));

  it("collects every page, confirms the full count, and calls strictly one at a time", async () => {
    allItems.mockResolvedValue([...candidates, item(500, "RoundTrip")]);
    let inFlight = 0;
    let maxInFlight = 0;
    softDelete.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;
      return answer(200, "SoftDeleted");
    });
    wrap(<OrphanBulkDelete run={sweep} />);

    const dialog = await startBulk();
    expect(allItems).toHaveBeenCalledWith(sweep.id, "Failed");
    expect(within(dialog).getByRole("heading").textContent).toContain("124");
    await userEvent.click(within(dialog).getByRole("button", { name: /Ja, slett 124/ }));

    await waitFor(() => expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("SoftDeleted: 124"), {
      timeout: 5000,
    });
    expect(softDelete).toHaveBeenCalledTimes(124);
    expect(maxInFlight).toBe(1);
    expect(screen.getByText(/Start en verify/)).toBeTruthy();
  });

  it("stops by itself on a 409 at the third estate, and says why", async () => {
    allItems.mockResolvedValue(candidates.slice(0, 10));
    softDelete
      .mockResolvedValueOnce(answer(200, "SoftDeleted"))
      .mockResolvedValueOnce(answer(200, "SoftDeleted"))
      .mockResolvedValueOnce(answer(409, "NotAllowed"));
    wrap(<OrphanBulkDelete run={sweep} />);

    const dialog = await startBulk();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ja, slett 10/ }));

    expect(await screen.findByTestId("orphan-bulk-stopped")).toBeTruthy();
    expect(screen.getByTestId("orphan-bulk-stopped").textContent).toContain("409");
    expect(softDelete).toHaveBeenCalledTimes(3);
  });

  it("carries on past NotAnOrphan and 404", async () => {
    allItems.mockResolvedValue(candidates.slice(0, 3));
    softDelete
      .mockResolvedValueOnce(answer(200, "NotAnOrphan", "hasEstateRow"))
      .mockResolvedValueOnce(answer(404, "InstanceNotFound"))
      .mockResolvedValueOnce(answer(200, "SoftDeleted"));
    wrap(<OrphanBulkDelete run={sweep} />);

    const dialog = await startBulk();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ja, slett 3/ }));

    await waitFor(() => expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("SoftDeleted: 1"));
    expect(softDelete).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("NotAnOrphan: 1");
    expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("InstanceNotFound: 1");
    expect(screen.queryByTestId("orphan-bulk-stopped")).toBeNull();

    // A result per estate (spec §5.2): every estate that wasn't deleted, by instance id and oed's reason.
    const problems = screen.getByTestId("orphan-bulk-problems");
    expect(within(problems).getByText("50000001/00000000-0000-0000-0000-000000000001")).toBeTruthy();
    expect(within(problems).getByText(/hasEstateRow/)).toBeTruthy();
    expect(within(problems).getByText("50000002/00000000-0000-0000-0000-000000000002")).toBeTruthy();
    expect(within(problems).getByText(/Instansen finnes ikke/)).toBeTruthy();
    expect(within(problems).queryByText("50000003/00000000-0000-0000-0000-000000000003")).toBeNull();
  });

  it("counts a rerun's already deleted estates as done, not failed", async () => {
    allItems.mockResolvedValue(candidates.slice(0, 2));
    softDelete.mockResolvedValueOnce(answer(200, "AlreadyDeleted")).mockResolvedValueOnce(answer(200, "SoftDeleted"));
    wrap(<OrphanBulkDelete run={sweep} />);

    const dialog = await startBulk();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ja, slett 2/ }));

    await waitFor(() => expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("AlreadyDeleted: 1"));
    expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("Ferdig: 2");
    expect(screen.queryByTestId("orphan-bulk-stopped")).toBeNull();
  });

  it("«Stopp» ends the loop after the call in flight", async () => {
    allItems.mockResolvedValue(candidates.slice(0, 10));
    const pending: Array<(value: OrphanSoftDeleteResult) => void> = [];
    softDelete.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    wrap(<OrphanBulkDelete run={sweep} />);

    const dialog = await startBulk();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ja, slett 10/ }));
    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0](answer(200, "SoftDeleted"));
    await waitFor(() => expect(pending).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Stopp" }));
    pending[1](answer(200, "SoftDeleted"));

    await waitFor(() => expect(screen.getByTestId("orphan-bulk-summary").textContent).toContain("SoftDeleted: 2"));
    expect(softDelete).toHaveBeenCalledTimes(2);
  });
});

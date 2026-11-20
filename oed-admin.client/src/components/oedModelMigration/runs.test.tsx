import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OedModelMigration from ".";
import type { MigrationRun, PhaseResult, RunItemsResult, RunResult } from "./api";
import { fetchWithMsal } from "../../utils/msalUtils";

// The page talks to oed-admin only through fetchWithMsal; MSAL itself is out of scope here.
vi.mock("../../utils/msalUtils", () => ({ fetchWithMsal: vi.fn() }));
const fetchMock = vi.mocked(fetchWithMsal);

const phase: PhaseResult = {
  status: 200,
  phase: { phase: "Storage", reason: "pause", changed: "2026-11-18T15:46:46+00:00", changedBy: "oed-admin-client", cachedOnThisPod: "Storage" },
  problem: null,
};

const runId = "11111111-1111-1111-1111-111111111111";

// As oed's snapshot oed_model_migration_run_get_contract.json.
const verifyRun = (overrides: Partial<MigrationRun> = {}): MigrationRun => ({
  id: runId,
  mode: "Verify",
  status: "Completed",
  requestedBy: "oed-admin-client",
  cancelRequestedBy: null,
  continuesRunId: null,
  created: "2026-11-17T10:00:00+02:00",
  started: "2026-11-17T10:00:05+02:00",
  finished: "2026-11-17T10:30:00+02:00",
  heartbeat: "2026-11-17T10:29:55+02:00",
  parameters: { limit: null, ratePerSecond: 2, maxParallelism: 2, sampleSize: 200 },
  progress: { listed: 1200, processed: 1200, toProcess: 1200 },
  failureReason: null,
  ready: false,
  report: {
    outcomes: { Ok: 1180, Missing: 15, Broken: 0, Mismatch: 0, SampleMismatch: 1, NotLive: 4 },
    failuresByReason: { RoundTrip: 3, NoDeceasedInfo: 0, NulCharacter: 0, NoCreated: 0, StorageError: 0 },
    duplicateOwnerCount: 1,
    duplicateOwnerPartyIds: [512345],
    databaseCreatedRows: 2,
    sampled: 200,
    ready: false,
  },
  ...overrides,
});

const runningSweep = (overrides: Partial<MigrationRun> = {}): MigrationRun =>
  verifyRun({
    mode: "Sweep",
    status: "Running",
    finished: null,
    parameters: { limit: 20, ratePerSecond: 2, maxParallelism: 2, sampleSize: null },
    progress: { listed: 1200, processed: 300, toProcess: 1200 },
    ready: null,
    report: null,
    ...overrides,
  });

const completedSweep = (): MigrationRun =>
  runningSweep({
    status: "Completed",
    finished: "2026-11-17T10:30:00+02:00",
    progress: { listed: 1200, processed: 1200, toProcess: 1200 },
    report: { ...verifyRun().report!, outcomes: { Copied: 1190, Failed: 10 }, ready: null },
  });

const ok = (run: MigrationRun, status = 200): RunResult => ({ status, run, problem: null, activeRunId: null });
const noRun: RunResult = { status: 404, run: null, problem: { title: "No run is active", detail: null, errors: null }, activeRunId: null };

const items: RunItemsResult = {
  status: 200,
  items: [
    {
      run: {
        instanceGuid: "33333333-3333-3333-3333-333333333333",
        instanceOwnerPartyId: 501337,
        outcome: "Missing",
        failure: "RoundTrip",
        reason: "oed/Heirs/HeirInfo[1]/Name",
        droppedElements: [],
        storageLastChanged: null,
        attempts: 2,
        updated: "2026-11-17T10:06:00+02:00",
      },
      estateId: "9bfa965f-63c9-466c-b038-000000000001",
    },
    {
      run: {
        instanceGuid: "44444444-4444-4444-4444-444444444444",
        instanceOwnerPartyId: 501338,
        outcome: "Missing",
        failure: null,
        reason: null,
        droppedElements: [],
        storageLastChanged: null,
        attempts: 0,
        updated: "2026-11-17T10:07:00+02:00",
      },
      estateId: null,
    },
  ],
  page: 1,
  pageSize: 100,
  total: 2,
  problem: null,
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let gets: Record<string, unknown> = {};

/**
 * Answers GETs from `gets` by URL fragment (the most specific first), and every other call from `answers` in order.
 * An answer that is a function is called instead, for a response that never comes. When the answers run out, the call
 * is a network error.
 */
const serve = (...answers: unknown[]) => {
  const queue = [...answers];
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if ((init?.method ?? "GET") === "GET") {
      const key = Object.keys(gets)
        .sort((a, b) => b.length - a.length)
        .find((fragment) => url.includes(fragment));
      if (key) return json(gets[key]);
      throw new Error(`Unexpected GET ${url}`);
    }
    const next = queue.shift();
    if (next === undefined) throw new TypeError("Failed to fetch");
    if (typeof next === "function") return (next as () => Promise<Response>)();
    return json(next);
  });
};

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
const getsTo = (fragment: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === "GET" && String(url).endsWith(fragment));
const lastIndexOf = (predicate: (url: string) => boolean) =>
  fetchMock.mock.calls.map(([url]) => String(url)).reduce((last, url, index) => (predicate(url) ? index : last), -1);

/** Lets the page's 15 s polls fire. */
const poll = () => act(() => vi.advanceTimersByTimeAsync(15_000));

const renderPage = () =>
  render(
    // Mutations retry by default here, at once, so only the page's own `retry: false` keeps a call from being repeated.
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 3, retryDelay: 0 } } })}
    >
      <MemoryRouter initialEntries={["/maintenance/oedmodel"]}>
        <OedModelMigration />
      </MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  fetchMock.mockReset();
  gets = {
    "/phase": phase,
    "/runs/active": noRun,
    "/runs/latest-verify": { ...noRun, problem: { title: "No verify run has finished", detail: null, errors: null } },
    [`/runs/${runId}/items`]: items,
  };
});

const runs = () => within(screen.getByRole("region", { name: "Kjøringer" }));

describe("latest verify next to the phase", () => {
  it("says when no verify has finished", async () => {
    serve();
    renderPage();

    expect(await screen.findByTestId("latest-verify")).toHaveTextContent("ingen er fullført");
  });

  it("shows ready, and opens the report", async () => {
    const user = userEvent.setup();
    gets["/runs/latest-verify"] = ok(verifyRun());
    gets[`/runs/${runId}`] = ok(verifyRun());
    serve();
    renderPage();

    const latest = await screen.findByTestId("latest-verify");
    expect(latest).toHaveTextContent("Completed");
    expect(latest).toHaveTextContent("Ready: nei");

    await user.click(within(latest).getByRole("button", { name: "Vis rapporten" }));

    const report = await screen.findByTestId("run-report");
    expect(within(report).getByTestId("run-ready")).toHaveTextContent("Ready: nei");
    expect(within(report).getByTestId("report-Utfall")).toHaveTextContent("Missing15");
    expect(within(report).getByTestId("report-Feil per årsak")).toHaveTextContent("RoundTrip3");
    expect(report).toHaveTextContent("party-id 512345");
  });
});

describe("the active run", () => {
  it("says when none is active", async () => {
    serve();
    renderPage();

    expect(await runs().findByText("Ingen kjøring er aktiv.")).toBeInTheDocument();
  });

  it("is shown with its progress, and blocks a new start", async () => {
    const user = userEvent.setup();
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve();
    renderPage();

    expect(await runs().findByTestId("run-progress")).toHaveTextContent("300 av 1200 behandlet");
    await user.click(runs().getByRole("radio", { name: /^Verify/ }));
    expect(runs().getByRole("button", { name: /Start kjøringen/ })).toBeDisabled();
  });

  it("explains an abandoned run", async () => {
    gets["/runs/latest-verify"] = ok(runningSweep({ status: "Abandoned" }));
    gets[`/runs/${runId}`] = ok(runningSweep({ status: "Abandoned" }));
    serve();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Vis rapporten" }));

    expect(await runs().findByText(/fortsetter den som en ny kjøring/)).toBeInTheDocument();
  });

  it("keeps showing a run after it ends, and reads its items and the latest verify again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve();
    renderPage();
    expect(await runs().findByTestId("run-progress")).toHaveTextContent("300 av 1200");
    const latestVerifyReads = getsTo("/runs/latest-verify").length;

    // oed stops listing it as active, possibly before the run itself has been read again.
    gets["/runs/active"] = noRun;
    await poll();
    expect(runs().getByTestId("run-progress")).toHaveTextContent("300 av 1200");
    expect(runs().queryByText("Ingen kjøring er aktiv.")).not.toBeInTheDocument();

    gets[`/runs/${runId}`] = ok(completedSweep());
    await poll();

    expect(await runs().findByTestId("run-report")).toHaveTextContent("Copied1190");
    expect(runs().getByTestId("run-progress")).toHaveTextContent("1200 av 1200");
    // Read again because the run ended, not on the next poll (the latest verify polls once a minute).
    expect(getsTo("/runs/latest-verify").length).toBeGreaterThan(latestVerifyReads);
    expect(lastIndexOf((url) => url.includes("/items?"))).toBeGreaterThan(lastIndexOf((url) => url.endsWith(`/runs/${runId}`)));
  });

  it("keeps a running run, and polling, through one failed read", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve();
    renderPage();
    expect(await runs().findByTestId("run-progress")).toHaveTextContent("300 av 1200");
    await user.click(runs().getByRole("radio", { name: /^Verify/ }));

    // An oed pod restarts: both reads answer 502 once.
    const unavailable: RunResult = { status: 502, run: null, problem: null, activeRunId: null };
    gets["/runs/active"] = unavailable;
    gets[`/runs/${runId}`] = unavailable;
    await poll();

    expect(await runs().findByTestId("run-fetch-error")).toHaveTextContent("Uventet svar fra oed (502)");
    expect(runs().getByTestId("run-progress")).toHaveTextContent("300 av 1200");
    expect(runs().getByRole("button", { name: /Start kjøringen/ })).toBeDisabled();

    gets["/runs/active"] = noRun;
    gets[`/runs/${runId}`] = ok(completedSweep());
    await poll();

    expect(await runs().findByTestId("run-report")).toBeInTheDocument();
    expect(runs().queryByTestId("run-fetch-error")).not.toBeInTheDocument();
  });

  it("shows a failed run's reason", async () => {
    gets["/runs/active"] = ok(runningSweep({ status: "Failed", failureReason: "Storage kept failing: 3 triggers" }));
    gets[`/runs/${runId}`] = ok(runningSweep({ status: "Failed", failureReason: "Storage kept failing: 3 triggers" }));
    serve();
    renderPage();

    expect(await runs().findByTestId("run-failure")).toHaveTextContent("Storage kept failing: 3 triggers");
  });
});

describe("starting a run", () => {
  it("confirms a verify, saying it writes no estate rows, then sends oed's defaults as null", async () => {
    const user = userEvent.setup();
    gets[`/runs/${runId}`] = ok(verifyRun({ status: "Queued", report: null, ready: null }));
    serve(ok(verifyRun({ status: "Queued", report: null, ready: null }), 202));
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Verify/ }));
    expect(runs().queryByRole("textbox", { name: /Grense/ })).not.toBeInTheDocument();
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));

    const dialog = runs().getByRole("alertdialog");
    expect(within(dialog).getByTestId("run-consequence")).toHaveTextContent("skriver ingen dødsbo-rader");
    expect(posts()).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Ja, start verify" }));

    expect(await runs().findByText(/lagt i kø/)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0][0])).toBe("/api/maintenance/oedmodel/runs");
    expect(JSON.parse(String(posts()[0][1]!.body))).toEqual({
      mode: "verify",
      limit: null,
      ratePerSecond: null,
      maxParallelism: null,
      sampleSize: null,
    });
    expect(await runs().findByTestId("run-details")).toHaveTextContent("Queued");
  });

  it("confirms a sweep with rule 5 and #1924, and sends the limit", async () => {
    const user = userEvent.setup();
    gets[`/runs/${runId}`] = ok(runningSweep({ status: "Queued" }));
    serve(ok(runningSweep({ status: "Queued" }), 202));
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Sweep/ }));
    expect(runs().queryByRole("textbox", { name: /Sample/ })).not.toBeInTheDocument();
    await user.type(runs().getByRole("textbox", { name: /Grense/ }), "20");
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));

    const consequence = runs().getByTestId("run-consequence");
    expect(consequence).toHaveTextContent("regel 5");
    expect(consequence).toHaveTextContent("#1924");
    expect(consequence).toHaveTextContent("høyst 20 dødsbo");

    await user.click(runs().getByRole("button", { name: "Ja, start sweep" }));

    await runs().findByText(/lagt i kø/);
    expect(JSON.parse(String(posts()[0][1]!.body))).toMatchObject({ mode: "sweep", limit: 20 });
  });

  it("refuses a value outside oed's limits before sending", async () => {
    const user = userEvent.setup();
    serve();
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Sweep/ }));
    await user.type(runs().getByRole("textbox", { name: /Dødsbo per sekund/ }), "11");

    expect(runs().getByRole("button", { name: /Start kjøringen/ })).toBeDisabled();
    expect(runs().getByText("Ugyldig verdi.")).toBeInTheDocument();
  });

  it("sends parallelism for a verify too, and accepts a decimal comma", async () => {
    const user = userEvent.setup();
    gets[`/runs/${runId}`] = ok(verifyRun({ status: "Queued", report: null, ready: null }));
    serve(ok(verifyRun({ status: "Queued", report: null, ready: null }), 202));
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Verify/ }));
    await user.type(runs().getByRole("textbox", { name: /Parallellitet/ }), "3");
    await user.type(runs().getByRole("textbox", { name: /Dødsbo per sekund/ }), "0,5");
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));
    await user.click(runs().getByRole("button", { name: "Ja, start verify" }));

    await runs().findByText(/lagt i kø/);
    expect(JSON.parse(String(posts()[0][1]!.body))).toMatchObject({ mode: "verify", maxParallelism: 3, ratePerSecond: 0.5 });
  });

  it("refuses a limit the server cannot hold", async () => {
    const user = userEvent.setup();
    serve();
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Sweep/ }));
    await user.type(runs().getByRole("textbox", { name: /Grense/ }), "2147483648");

    expect(runs().getByText("Ugyldig verdi.")).toBeInTheDocument();
    expect(runs().getByRole("button", { name: /Start kjøringen/ })).toBeDisabled();
  });

  it("takes focus to the confirm button", async () => {
    const user = userEvent.setup();
    serve();
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Verify/ }));
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));

    expect(runs().getByRole("button", { name: "Ja, start verify" })).toHaveFocus();
  });

  it("shows a 409's detail verbatim, and offers the active run", async () => {
    const user = userEvent.setup();
    const otherId = "22222222-2222-2222-2222-222222222222";
    gets[`/runs/${otherId}`] = ok(runningSweep({ id: otherId }));
    serve({
      status: 409,
      run: null,
      problem: { title: "A run is already active", detail: "Another OED_M migration run is queued or running. Wait for it, or cancel it.", errors: null },
      activeRunId: otherId,
    } satisfies RunResult);
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Verify/ }));
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));
    await user.click(runs().getByRole("button", { name: "Ja, start verify" }));

    expect(await runs().findByTestId("run-problem-detail")).toHaveTextContent(
      /^Another OED_M migration run is queued or running\. Wait for it, or cancel it\.$/,
    );
    await user.click(runs().getByRole("button", { name: "Vis den aktive kjøringen" }));
    expect(await runs().findByTestId("run-progress")).toHaveTextContent("300 av 1200");
    expect(posts()).toHaveLength(1);
  });

  it("does not retry a start after a network error", async () => {
    const user = userEvent.setup();
    serve();
    renderPage();

    await user.click(await runs().findByRole("radio", { name: /^Verify/ }));
    await user.click(runs().getByRole("button", { name: /Start kjøringen/ }));
    await user.click(runs().getByRole("button", { name: "Ja, start verify" }));

    expect(await runs().findByText(/Kunne ikke starte/)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });
});

describe("cancelling a run", () => {
  it("asks first, then posts the cancel once", async () => {
    const user = userEvent.setup();
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve(ok(runningSweep({ cancelRequestedBy: "oed-admin-client" }), 202));
    renderPage();

    await user.click(await runs().findByRole("button", { name: /Avbryt kjøringen/ }));
    expect(posts()).toHaveLength(0);
    await user.click(runs().getByRole("button", { name: "Ja, avbryt kjøringen" }));

    expect(await runs().findByText("Avbrudd er bedt om.")).toBeInTheDocument();
    expect(posts().map(([url]) => String(url))).toEqual([`/api/maintenance/oedmodel/runs/${runId}/cancel`]);
  });

  it("takes an oed answer of 200 as accepted too, and focuses the confirm button", async () => {
    const user = userEvent.setup();
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve(ok(runningSweep({ cancelRequestedBy: "oed-admin-client" }), 200));
    renderPage();

    await user.click(await runs().findByRole("button", { name: /Avbryt kjøringen/ }));
    const confirm = runs().getByRole("button", { name: "Ja, avbryt kjøringen" });
    expect(confirm).toHaveFocus();
    await user.click(confirm);

    expect(await runs().findByText("Avbrudd er bedt om.")).toBeInTheDocument();
    expect(runs().queryByTestId("run-problem")).not.toBeInTheDocument();
  });

  it("does not retry a cancel after a network error", async () => {
    const user = userEvent.setup();
    gets["/runs/active"] = ok(runningSweep());
    gets[`/runs/${runId}`] = ok(runningSweep());
    serve();
    renderPage();

    await user.click(await runs().findByRole("button", { name: /Avbryt kjøringen/ }));
    await user.click(runs().getByRole("button", { name: "Ja, avbryt kjøringen" }));

    expect(await runs().findByText(/Kunne ikke avbryte/)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });
});

describe("a run's items", () => {
  it("lists the default outcome, links to the estate, and fills the copy form", async () => {
    const user = userEvent.setup();
    gets["/runs/latest-verify"] = ok(verifyRun());
    gets[`/runs/${runId}`] = ok(verifyRun());
    serve();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Vis rapporten" }));

    const list = await runs().findByTestId("run-items");
    expect(await within(list).findByTestId("run-items-total")).toHaveTextContent("2 dødsbo med utfall Missing");
    const itemCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/items"));
    expect(itemCalls[0]).toBe(`/api/maintenance/oedmodel/runs/${runId}/items?page=1&pageSize=100&outcome=Missing`);

    expect(within(list).getByRole("link", { name: "Åpne dødsbo" })).toHaveAttribute(
      "href",
      "/estate/9bfa965f-63c9-466c-b038-000000000001",
    );
    expect(within(list).getAllByRole("link")).toHaveLength(1);

    await user.click(within(list).getAllByRole("button", { name: "Kopier …" })[0]);

    expect(screen.getByRole("textbox", { name: /Instans-id/ })).toHaveValue("501337/33333333-3333-3333-3333-333333333333");
    expect(posts()).toHaveLength(0);
  });

  it("cannot refill the copy form while a copy is in flight", async () => {
    const user = userEvent.setup();
    gets["/runs/latest-verify"] = ok(verifyRun());
    gets[`/runs/${runId}`] = ok(verifyRun());
    serve(() => new Promise<Response>(() => {}));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Vis rapporten" }));
    const list = await runs().findByTestId("run-items");
    await within(list).findByTestId("run-items-total");

    await user.click(within(list).getAllByRole("button", { name: "Kopier …" })[0]);
    const copy = within(screen.getByRole("region", { name: "Kopier ett dødsbo" }));
    await user.click(copy.getByRole("button", { name: "Kopier …" }));
    await user.click(copy.getByRole("button", { name: "Ja, kopier" }));

    expect(await copy.findByText("Kopierer …")).toBeInTheDocument();
    for (const button of within(list).getAllByRole("button", { name: "Kopier …" })) expect(button).toBeDisabled();
  });

  it("leaves outcome out when the person picks all", async () => {
    const user = userEvent.setup();
    gets["/runs/latest-verify"] = ok(verifyRun());
    gets[`/runs/${runId}`] = ok(verifyRun());
    serve();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Vis rapporten" }));
    const list = await runs().findByTestId("run-items");

    await user.selectOptions(within(list).getByLabelText("Utfall"), "");

    await within(list).findByText("2 dødsbo.");
    const last = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/items")).at(-1);
    expect(last).toBe(`/api/maintenance/oedmodel/runs/${runId}/items?page=1&pageSize=100`);
  });
});

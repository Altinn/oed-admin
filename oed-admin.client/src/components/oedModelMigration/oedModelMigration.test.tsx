import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OedModelMigration from ".";
import type { CopyResult, PhaseResult } from "./api";
import { fetchWithMsal } from "../../utils/msalUtils";

// The page talks to oed-admin only through fetchWithMsal; MSAL itself is out of scope here.
vi.mock("../../utils/msalUtils", () => ({ fetchWithMsal: vi.fn() }));
const fetchMock = vi.mocked(fetchWithMsal);

const storagePhase: PhaseResult = {
  status: 200,
  phase: {
    phase: "Storage",
    reason: "Initial phase",
    changed: "2026-11-17T08:52:48+00:00",
    changedBy: "migration",
    cachedOnThisPod: "Storage",
  },
  problem: null,
};

const instanceGuid = "55555555-5555-5555-5555-555555555555";

const copied = (overrides: Partial<CopyResult> = {}, copy: Partial<NonNullable<CopyResult["copy"]>> = {}): CopyResult => ({
  status: 200,
  copy: {
    outcome: "Copied",
    failure: null,
    failureReason: null,
    droppedElements: ["oed/Heirs/HeirInfo/Obsolete"],
    storageLastChanged: "2026-06-07T08:09:10+00:00",
    created: "2025-01-02T01:04:05+00:00",
    ...copy,
  },
  problem: null,
  retryAfterSeconds: null,
  ...overrides,
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** oed-admin itself failing, as opposed to a body carrying oed's status. */
const failure = (status: number) => ({ failWith: status });

const noRun = { status: 404, run: null, problem: { title: "No run is active", detail: null, errors: null }, activeRunId: null };

/** Fixed answers to GETs, by URL fragment: the runs the page reads on its own. Reset before each test. */
let gets: Record<string, unknown> = {};

/**
 * Answers GET phase with `phase`, the GETs in `gets` from there, and every other call from `answers` in order. A
 * `failure(...)` answers with that HTTP status from oed-admin; when the answers run out, the call is a network error.
 */
const serve = (phase: PhaseResult, ...answers: unknown[]) => {
  const queue = [...answers];
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/phase") && method === "GET") return json(phase);
    if (method === "GET") {
      const key = Object.keys(gets)
        .sort((a, b) => b.length - a.length)
        .find((fragment) => url.includes(fragment));
      if (key) return json(gets[key]);
    }
    const next = queue.shift();
    if (next === undefined) throw new TypeError("Failed to fetch");
    if (typeof next === "object" && next !== null && "failWith" in next) {
      return new Response("", { status: (next as { failWith: number }).failWith });
    }
    return json(next);
  });
};

const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

const renderPage = (path = "/maintenance/oedmodel") =>
  render(
    // Mutations retry by default here, at once, so only the page's own `retry: false` keeps a state-changing call from
    // being repeated.
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 3, retryDelay: 0 } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <OedModelMigration />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  fetchMock.mockReset();
  gets = { "/runs/active": noRun, "/runs/latest-verify": { ...noRun, problem: { title: "No verify run has finished", detail: null, errors: null } } };
});

describe("phase", () => {
  it("shows the stored phase with who changed it and what this pod sees", async () => {
    serve(storagePhase);
    renderPage();

    expect(await screen.findByTestId("current-phase")).toHaveTextContent("Storage");
    expect(screen.getByText("Initial phase")).toBeInTheDocument();
    expect(screen.getByText("migration")).toBeInTheDocument();
    expect(screen.getByText(/innen omtrent 5 sekunder/)).toBeInTheDocument();
  });

  it.each([
    ["Migrating", /regel 5/],
    ["Database", /kan ikke lenger leses eller skrives/],
    ["Storage", /Ingenting flyttes tilbake til Storage/],
  ])("asks for confirmation before setting %s, and spells out the consequence", async (phase, consequence) => {
    const user = userEvent.setup();
    serve(storagePhase, { ...storagePhase, phase: { ...storagePhase.phase!, phase } });
    renderPage();
    await screen.findByTestId("current-phase");

    await user.click(screen.getByRole("radio", { name: new RegExp(`^${phase}`) }));
    await user.type(screen.getByRole("textbox", { name: /Begrunnelse/ }), "canary done");
    await user.click(screen.getByRole("button", { name: /Endre fasen/ }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByTestId("phase-consequence")).toHaveTextContent(consequence);
    expect(calls("PUT")).toHaveLength(0);
    // Keyboard and screen-reader users are taken to the confirmation.
    expect(within(dialog).getByRole("button", { name: `Ja, sett fasen til ${phase}` })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: `Ja, sett fasen til ${phase}` }));

    expect(await screen.findByText(`Fasen er satt til ${phase}.`)).toBeInTheDocument();
    const puts = calls("PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(String(puts[0][1]!.body))).toEqual({ phase, reason: "canary done" });
  });

  it("sends nothing when the person cancels the confirmation", async () => {
    const user = userEvent.setup();
    serve(storagePhase);
    renderPage();
    await screen.findByTestId("current-phase");

    await user.click(screen.getByRole("radio", { name: /^Migrating/ }));
    await user.type(screen.getByRole("textbox", { name: /Begrunnelse/ }), "canary");
    await user.click(screen.getByRole("button", { name: /Endre fasen/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Avbryt" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(calls("PUT")).toHaveLength(0);
  });

  it("requires a reason", async () => {
    const user = userEvent.setup();
    serve(storagePhase);
    renderPage();
    await screen.findByTestId("current-phase");

    await user.click(screen.getByRole("radio", { name: /^Storage/ }));
    await user.type(screen.getByRole("textbox", { name: /Begrunnelse/ }), "   ");

    expect(screen.getByRole("button", { name: /Endre fasen/ })).toBeDisabled();
  });

  it("treats a 200 without a phase as unexpected", async () => {
    serve({ status: 200, phase: null, problem: null });
    renderPage();

    expect(await screen.findByTestId("phase-problem")).toHaveTextContent("svaret manglet fasen");
    expect(screen.queryByTestId("current-phase")).not.toBeInTheDocument();
  });

  it.each([
    ["a network error", [] as unknown[]],
    ["a 500 from oed-admin", [failure(500)]],
  ])("does not retry a phase change after %s", async (_, answers) => {
    const user = userEvent.setup();
    serve(storagePhase, ...answers);
    renderPage();
    await screen.findByTestId("current-phase");

    await user.click(screen.getByRole("radio", { name: /^Storage/ }));
    await user.type(screen.getByRole("textbox", { name: /Begrunnelse/ }), "pause");
    await user.click(screen.getByRole("button", { name: /Endre fasen/ }));
    await user.click(screen.getByRole("button", { name: "Ja, sett fasen til Storage" }));

    expect(await screen.findByText(/Kunne ikke endre fasen/)).toBeInTheDocument();
    expect(calls("PUT")).toHaveLength(1);
  });

  it("shows a 409's detail verbatim and does not retry", async () => {
    const user = userEvent.setup();
    const detail = "No verify run exists yet (#1902)";
    serve(storagePhase, {
      status: 409,
      phase: null,
      problem: { title: "The phase can't be set to Database", detail, errors: null },
    } satisfies PhaseResult);
    renderPage();
    await screen.findByTestId("current-phase");

    await user.click(screen.getByRole("radio", { name: /^Database/ }));
    await user.type(screen.getByRole("textbox", { name: /Begrunnelse/ }), "test");
    await user.click(screen.getByRole("button", { name: /Endre fasen/ }));
    await user.click(screen.getByRole("button", { name: "Ja, sett fasen til Database" }));

    expect(await screen.findByTestId("phase-problem-detail")).toHaveTextContent(new RegExp(`^${escape(detail)}$`));
    expect(screen.getByTestId("current-phase")).toHaveTextContent("Storage");
    expect(calls("PUT")).toHaveLength(1);
  });
});

describe("copy one estate", () => {
  const copyFrom = async (answer: CopyResult) => {
    const user = userEvent.setup();
    serve(storagePhase, answer);
    renderPage(`/maintenance/oedmodel?instanceId=512345/${instanceGuid}`);
    await user.click(screen.getByRole("button", { name: /Kopier/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Ja, kopier" }));
    return { user, verdict: await screen.findByTestId("copy-verdict") };
  };

  it("takes the instance id from the estate view, and posts only after confirmation", async () => {
    const user = userEvent.setup();
    serve(storagePhase, copied());
    renderPage(`/maintenance/oedmodel?instanceId=512345/${instanceGuid}`);

    expect(screen.getByRole("textbox", { name: /Instans-id/ })).toHaveValue(`512345/${instanceGuid}`);
    await user.click(screen.getByRole("button", { name: /Kopier/ }));
    expect(calls("POST")).toHaveLength(0);
    // Keyboard and screen-reader users are taken to the confirmation.
    expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Ja, kopier" })).toHaveFocus();

    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Ja, kopier" }));
    await screen.findByTestId("copy-verdict");

    expect(calls("POST").map(([url]) => url)).toEqual([`/api/maintenance/oedmodel/estates/512345/${instanceGuid}/copy`]);
  });

  it("refuses an instance id that isn't {partyId}/{guid}", async () => {
    const user = userEvent.setup();
    serve(storagePhase);
    renderPage();

    await user.type(screen.getByRole("textbox", { name: /Instans-id/ }), "512345");

    expect(screen.getByRole("button", { name: /Kopier/ })).toBeDisabled();
    expect(screen.getByText(/Skriv instans-id-en som/)).toBeInTheDocument();
  });

  it("shows every field of the answer", async () => {
    await copyFrom(copied());

    const answer = screen.getByTestId("copy-answer");
    expect(answer).toHaveTextContent("Copied");
    expect(answer).toHaveTextContent("oed/Heirs/HeirInfo/Obsolete");
    expect(answer).toHaveTextContent("2026-06-07T08:09:10+00:00");
    expect(answer).toHaveTextContent("2025-01-02T01:04:05+00:00");
  });

  it.each<[string, CopyResult, RegExp, string]>([
    ["Copied", copied(), /Kopiert/, "success"],
    ["AlreadyMigrated", copied({}, { outcome: "AlreadyMigrated" }), /allerede en rad/, "success"],
    ["NoOedElement", copied({}, { outcome: "NoOedElement" }), /ingenting å kopiere.*en person/, "warning"],
    ["Failed RoundTrip", copied({}, { outcome: "Failed", failure: "RoundTrip", failureReason: "/oed/Heirs[1]" }), /RoundTrip.*en person/, "danger"],
    ["Failed NoDeceasedInfo", copied({}, { outcome: "Failed", failure: "NoDeceasedInfo" }), /NoDeceasedInfo/, "danger"],
    ["Failed NulCharacter", copied({}, { outcome: "Failed", failure: "NulCharacter" }), /NulCharacter/, "danger"],
    ["Failed NoCreated", copied({}, { outcome: "Failed", failure: "NoCreated" }), /NoCreated/, "danger"],
    ["404", copied({ status: 404 }, { outcome: "InstanceNotFound" }), /finnes ikke/, "danger"],
    ["409", copied({ status: 409 }, { outcome: "NotAllowed" }), /BlockAppLibOedDataRoutes/, "danger"],
    ["502", copied({ status: 502 }, { outcome: "Failed", failure: "StorageError" }), /Storage feilet/, "danger"],
    ["0", { status: 0, copy: null, problem: { title: "No answer from oed", detail: "timeout", errors: null }, retryAfterSeconds: null }, /Fikk ikke svar/, "danger"],
    ["403", { status: 403, copy: null, problem: null, retryAfterSeconds: null }, /digdir:dd:systemadmin/, "danger"],
    ["404 without oed's copy answer", { status: 404, copy: null, problem: null, retryAfterSeconds: null }, /Uventet svar fra oed \(404\)/, "danger"],
    ["502 without StorageError", { status: 502, copy: null, problem: null, retryAfterSeconds: null }, /Uventet svar fra oed \(502\)/, "danger"],
  ])("maps %s", async (_, answer, message, severity) => {
    const { verdict } = await copyFrom(answer);

    expect(verdict).toHaveTextContent(message);
    expect(verdict).toHaveAttribute("data-color", severity);
    expect(screen.queryByRole("button", { name: /Prøv igjen/ })).not.toBeInTheDocument();
  });

  it.each([
    ["a network error", [] as unknown[]],
    ["a 500 from oed-admin", [failure(500)]],
  ])("does not retry a copy after %s", async (_, answers) => {
    const user = userEvent.setup();
    serve(storagePhase, ...answers);
    renderPage(`/maintenance/oedmodel?instanceId=512345/${instanceGuid}`);
    await user.click(screen.getByRole("button", { name: /Kopier/ }));
    await user.click(screen.getByRole("button", { name: "Ja, kopier" }));

    expect(await screen.findByText(/Kunne ikke kopiere/)).toBeInTheDocument();
    expect(calls("POST")).toHaveLength(1);
  });

  it("shows failureReason with a failure", async () => {
    await copyFrom(copied({}, { outcome: "Failed", failure: "RoundTrip", failureReason: "/oed/Heirs[1]/Name differs" }));

    expect(screen.getByTestId("copy-answer")).toHaveTextContent("/oed/Heirs[1]/Name differs");
  });

  it("offers to try again after a 503, only when the person asks", async () => {
    const busy: CopyResult = {
      status: 503,
      copy: null,
      problem: { title: "The estate is busy", detail: "try again", errors: null },
      retryAfterSeconds: 0,
    };
    const user = userEvent.setup();
    serve(storagePhase, busy, copied());
    renderPage(`/maintenance/oedmodel?instanceId=512345/${instanceGuid}`);
    await user.click(screen.getByRole("button", { name: /Kopier/ }));
    await user.click(screen.getByRole("button", { name: "Ja, kopier" }));

    expect(await screen.findByTestId("copy-verdict")).toHaveTextContent(/opptatt/);
    expect(calls("POST")).toHaveLength(1);

    await user.click(await screen.findByRole("button", { name: "Prøv igjen" }));

    expect(await screen.findByText(/Kopiert/)).toBeInTheDocument();
    expect(calls("POST")).toHaveLength(2);
  });

  it("waits for Retry-After before the retry button is enabled", async () => {
    await copyFrom({ status: 503, copy: null, problem: null, retryAfterSeconds: 10 });

    expect(screen.getByRole("button", { name: /Prøv igjen om \d+ s/ })).toBeDisabled();
  });
});

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

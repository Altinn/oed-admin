import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Heading,
  Paragraph,
  Skeleton,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";
import {
  METRIC_COLUMNS,
  formatTimestamp,
  metricPoints,
  metricSeries,
  trendColor,
  trendKind,
  type Direction,
  type MetricColumn,
} from "./chartUtils";
import { GateTimeline, MetricChart, Sparkline } from "./charts";

// Mirrors the QaDashboardDto returned by GET /api/qa (read from the oedqa "reports" blob container).
interface QaFinding {
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
}
interface QaHotspot {
  rule: string;
  probability: string;
  category: string;
  component: string;
  line?: number;
  message: string;
}
interface QaSnapshot {
  timestamp: string;
  gateStatus: string;
  metrics: Record<string, string>;
  bugs: QaFinding[];
  codeSmells: QaFinding[];
  hotspots: QaHotspot[];
}
interface QaProject {
  name: string;
  snapshots: QaSnapshot[];
}
interface QaDashboardDto {
  projects: QaProject[];
}

function displayValue(metrics: Record<string, string>, col: MetricColumn): string {
  const raw = metrics[col.key];
  if (raw === undefined || raw === "") return "–";
  if (col.debt) {
    const minutes = parseInt(raw, 10);
    return Number.isNaN(minutes) ? "–" : (minutes / 60).toFixed(1);
  }
  return raw;
}

// Colour for a SonarQube severity / hotspot probability — ranking at a glance, not red-only.
function severityColor(value: string): string | undefined {
  switch (value.toLowerCase()) {
    case "blocker":
    case "high":
      return "#f85149";
    case "critical":
      return "#ff8b6b";
    case "major":
    case "medium":
      return "#d29922";
    case "info":
      return "#8b949e";
    default:
      return undefined;
  }
}

function Trend({ cur, prev, dir }: { cur?: string; prev?: string; dir: Direction }) {
  if (cur === undefined || prev === undefined) return null;
  const c = parseFloat(cur);
  const p = parseFloat(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || c === p) return null;

  const color = trendColor(trendKind(p, c, dir));

  // Decorative: the number itself already conveys the value; colour is not the sole signal.
  return (
    <span aria-hidden style={{ color, marginLeft: "0.3em", fontSize: "0.8em" }} title={`Forrige: ${prev}`}>
      {c > p ? "▲" : "▼"}
    </span>
  );
}

const numCellStyle = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;

// `snapshots` (the project's full history, newest-first) is only passed in the overview,
// where each row represents one project — there a sparkline shows the metric's evolution.
// In the per-snapshot history table it is omitted (a one-row sparkline is meaningless).
function MetricCells({
  snapshot,
  prev,
  snapshots,
}: {
  snapshot: QaSnapshot;
  prev?: QaSnapshot;
  snapshots?: QaSnapshot[];
}) {
  return (
    <>
      {METRIC_COLUMNS.map((col) => (
        <Table.Cell key={col.key} style={numCellStyle}>
          {displayValue(snapshot.metrics, col)}
          <Trend cur={snapshot.metrics[col.key]} prev={prev?.metrics[col.key]} dir={col.dir} />
          {snapshots && <Sparkline values={metricSeries(snapshots, col)} dir={col.dir} />}
        </Table.Cell>
      ))}
    </>
  );
}

function GateTag({ status }: { status: string }) {
  const ok = status === "OK";
  return (
    <Tag data-color={ok ? "success" : "danger"} data-size="sm">
      {status}
    </Tag>
  );
}

function MetricHeaders() {
  return (
    <>
      {METRIC_COLUMNS.map((col) => (
        <Table.HeaderCell key={col.key} style={{ textAlign: "right" }}>
          {col.label}
        </Table.HeaderCell>
      ))}
    </>
  );
}

function Overview({ projects, onSelect }: { projects: QaProject[]; onSelect: (name: string) => void }) {
  return (
    <Table data-size="sm" style={{ width: "100%", marginBottom: "var(--ds-size-4)" }}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Prosjekt</Table.HeaderCell>
          <Table.HeaderCell>Siste kjøring (UTC)</Table.HeaderCell>
          <Table.HeaderCell>Gate</Table.HeaderCell>
          <MetricHeaders />
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {projects.map((project) => {
          const latest = project.snapshots[0];
          const prev = project.snapshots[1];
          return (
            <Table.Row key={project.name}>
              <Table.Cell>
                <Button variant="tertiary" data-size="sm" onClick={() => onSelect(project.name)}>
                  {project.name}
                </Button>
              </Table.Cell>
              <Table.Cell>{formatTimestamp(latest.timestamp)}</Table.Cell>
              <Table.Cell>
                <GateTag status={latest.gateStatus} />
              </Table.Cell>
              <MetricCells snapshot={latest} prev={prev} snapshots={project.snapshots} />
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}

// Findings/hotspots lists hold up to 50 entries; show this many before the "show all" expander.
const INITIAL_FINDINGS = 10;

function ShowMoreButton({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= INITIAL_FINDINGS) return null;
  return (
    <Button variant="tertiary" data-size="sm" onClick={onToggle} style={{ marginBottom: "var(--ds-size-4)" }}>
      {expanded ? "Vis færre" : `Vis alle (${total})`}
    </Button>
  );
}

function FindingsTable({ heading, findings }: { heading: string; findings: QaFinding[] }) {
  const [expanded, setExpanded] = useState(false);
  if (findings.length === 0) return null;
  const shown = expanded ? findings : findings.slice(0, INITIAL_FINDINGS);
  return (
    <>
      <Heading level={3} data-size="xs" style={{ margin: "3rem 0 var(--ds-size-3)" }}>
        {heading}
      </Heading>
      <Table data-size="sm" style={{ width: "100%", marginBottom: "var(--ds-size-2)" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Alvorlighet</Table.HeaderCell>
            <Table.HeaderCell>Regel</Table.HeaderCell>
            <Table.HeaderCell>Plassering</Table.HeaderCell>
            <Table.HeaderCell>Melding</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {shown.map((f, i) => (
            <Table.Row key={`${f.rule}-${i}`}>
              <Table.Cell style={{ color: severityColor(f.severity), fontWeight: 600 }}>{f.severity}</Table.Cell>
              <Table.Cell>
                <code>{f.rule}</code>
              </Table.Cell>
              <Table.Cell>{f.line != null ? `${f.component}:${f.line}` : f.component}</Table.Cell>
              <Table.Cell>{f.message}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <ShowMoreButton total={findings.length} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
    </>
  );
}

function HotspotsTable({ hotspots }: { hotspots: QaHotspot[] }) {
  const [expanded, setExpanded] = useState(false);
  if (hotspots.length === 0) return null;
  const shown = expanded ? hotspots : hotspots.slice(0, INITIAL_FINDINGS);
  return (
    <>
      <Heading level={3} data-size="xs" style={{ margin: "3rem 0 var(--ds-size-3)" }}>
        Topp sikkerhetspunkter
      </Heading>
      <Table data-size="sm" style={{ width: "100%", marginBottom: "var(--ds-size-2)" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Sannsynlighet</Table.HeaderCell>
            <Table.HeaderCell>Kategori</Table.HeaderCell>
            <Table.HeaderCell>Regel</Table.HeaderCell>
            <Table.HeaderCell>Plassering</Table.HeaderCell>
            <Table.HeaderCell>Melding</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {shown.map((h, i) => (
            <Table.Row key={`${h.rule}-${i}`}>
              <Table.Cell style={{ color: severityColor(h.probability), fontWeight: 600 }}>{h.probability}</Table.Cell>
              <Table.Cell>{h.category}</Table.Cell>
              <Table.Cell>
                <code>{h.rule}</code>
              </Table.Cell>
              <Table.Cell>{h.line != null ? `${h.component}:${h.line}` : h.component}</Table.Cell>
              <Table.Cell>{h.message}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <ShowMoreButton total={hotspots.length} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
    </>
  );
}

function ProjectDetail({ project, onBack }: { project: QaProject; onBack: () => void }) {
  const latest = project.snapshots[0];
  return (
    <>
      <Button
        variant="tertiary"
        data-size="sm"
        onClick={onBack}
        style={{ padding: 0, minHeight: 0, fontSize: "0.8rem" }}
      >
        ← Alle prosjekter
      </Button>
      <Heading level={2} data-size="sm" style={{ margin: "1rem 0 0" }}>
        {project.name}
      </Heading>

      <Heading level={3} data-size="xs" style={{ margin: "2rem 0 var(--ds-size-3)" }}>
        Trender
      </Heading>
      <GateTimeline snapshots={project.snapshots} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--ds-size-3)",
          marginTop: "var(--ds-size-3)",
          marginBottom: "var(--ds-size-4)",
        }}
      >
        {METRIC_COLUMNS.map((col) => {
          const points = metricPoints(project.snapshots, col);
          return points.length === 0 ? null : <MetricChart key={col.key} col={col} points={points} />;
        })}
      </div>

      <Heading level={3} data-size="xs" style={{ margin: "2rem 0 var(--ds-size-3)" }}>
        Historikk
      </Heading>
      <Table data-size="sm" style={{ width: "100%", marginBottom: "var(--ds-size-4)" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Kjøring (UTC)</Table.HeaderCell>
            <Table.HeaderCell>Gate</Table.HeaderCell>
            <MetricHeaders />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {project.snapshots.map((snapshot, i) => (
            <Table.Row key={snapshot.timestamp}>
              <Table.Cell>{formatTimestamp(snapshot.timestamp)}</Table.Cell>
              <Table.Cell>
                <GateTag status={snapshot.gateStatus} />
              </Table.Cell>
              <MetricCells snapshot={snapshot} prev={project.snapshots[i + 1]} />
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <FindingsTable heading="Topp bugs" findings={latest.bugs} />
      <FindingsTable heading="Topp code smells" findings={latest.codeSmells} />
      <HotspotsTable hotspots={latest.hotspots} />
    </>
  );
}

export default function QaDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<QaDashboardDto>({
    queryKey: ["qaDashboard"],
    queryFn: async () => {
      const response = await fetchWithMsal("/api/qa");
      if (!response.ok) {
        throw new Error("Kunne ikke hente kvalitetsdata");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <Skeleton variant="rectangle" aria-label="Henter kvalitetsdata" style={{ height: "12rem" }} />;
  }
  if (error) {
    return <ValidationMessage>Det oppstod en feil under henting av kvalitetsdata: {error.message}</ValidationMessage>;
  }
  if (!data || data.projects.length === 0) {
    return <Paragraph>Ingen kvalitetsdata enda. Dashbordet fylles ut etter første QA-kjøring.</Paragraph>;
  }

  const selectedProject = selected ? data.projects.find((p) => p.name === selected) : undefined;
  return selectedProject ? (
    <ProjectDetail project={selectedProject} onBack={() => setSelected(null)} />
  ) : (
    <Overview projects={data.projects} onSelect={setSelected} />
  );
}

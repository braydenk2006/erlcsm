"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type CaseRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  narrative: string;
  updatedAt: string;
};
type Evidence = {
  id: string;
  number: string;
  type: string;
  description: string;
  status: string;
  storageLocation: string | null;
  caseId: string | null;
  collectedAt: string;
};
type Relationship = {
  relation: string;
  label: string;
  direction: string;
  record: { type: string; id: string; number: string; title: string; href: string };
};
type TimelineEntry = { type: string; title: string; occurredAt: string };
type CaseDetail = {
  case: CaseRow;
  timeline: TimelineEntry[];
  relationships: Relationship[];
  evidence: Evidence[];
};
type CustodyEvent = {
  sequence: number;
  action: string;
  fromUserId: string | null;
  toUserId: string | null;
  reason: string | null;
  condition: string | null;
  at: string;
};
type CustodyChain = {
  evidence: Evidence;
  chain: CustodyEvent[];
  integrity: { valid: boolean; issues: string[] };
};
type Metrics = {
  openCases: number;
  evidenceAwaitingReview: number;
  courtBacklog: number;
  jailPopulation: number;
  internalAffairsCases: number;
  avgInvestigationDays: number | null;
};
type SearchResult = { type: string; id: string; number: string; title: string; snippet: string };

const CASE_STATUSES = [
  "OPEN",
  "ACTIVE",
  "PENDING",
  "AWAITING_EVIDENCE",
  "AWAITING_REVIEW",
  "AWAITING_COURT",
  "CLOSED",
  "ARCHIVED",
];
const MODULE_TYPES = [
  { type: "court_case", label: "Court Case" },
  { type: "jail_booking", label: "Jail Booking" },
  { type: "detective_case", label: "Detective Case" },
  { type: "ia_complaint", label: "Internal Affairs" },
  { type: "fleet_vehicle", label: "Fleet Vehicle" },
  { type: "fire_incident", label: "Fire Incident" },
  { type: "ems_patient", label: "EMS Patient" },
  { type: "business", label: "Business" },
  { type: "address", label: "Address" },
];
const statusTone: Record<string, "success" | "warning" | "accent" | "neutral" | "danger"> = {
  OPEN: "accent",
  ACTIVE: "accent",
  CLOSED: "success",
  ARCHIVED: "neutral",
  COLLECTED: "accent",
  CHECKED_OUT: "warning",
  RETURNED: "success",
  DESTROYED: "danger",
  IN_STORAGE: "neutral",
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json;
}

export function RmsConsole({ canManageCases }: { canManageCases: boolean }) {
  const [tab, setTab] = useState<"cases" | "search" | "modules">("cases");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [custody, setCustody] = useState<CustodyChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [narrative, setNarrative] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [moduleType, setModuleType] = useState(MODULE_TYPES[0]!.type);
  const [moduleTitle, setModuleTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const json = await api("/api/rms/cases");
      setCases(json.cases);
      setMetrics(json.metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const notify = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  };
  const openCase = async (id: string) => {
    setCustody(null);
    try {
      setDetail(await api(`/api/rms/cases/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const openEvidence = async (id: string) => {
    try {
      setCustody(await api(`/api/rms/evidence/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const createCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = await api("/api/rms/cases", {
        method: "POST",
        body: JSON.stringify({ title: caseTitle }),
      });
      setCaseTitle("");
      await load();
      await openCase(json.case.id);
      notify(`Created ${json.case.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const collectEvidence = async () => {
    if (!detail) return;
    try {
      await api("/api/rms/evidence", {
        method: "POST",
        body: JSON.stringify({ description: evDesc, caseId: detail.case.id }),
      });
      setEvDesc("");
      await openCase(detail.case.id);
      notify("Evidence collected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const custodyAction = async (action: string) => {
    if (!custody) return;
    try {
      await api(`/api/rms/evidence/${custody.evidence.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await openEvidence(custody.evidence.id);
      if (detail) await openCase(detail.case.id);
      notify(`Evidence ${action}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const setStatus = async (status: string) => {
    if (!detail) return;
    try {
      await api(`/api/rms/cases/${detail.case.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status }),
      });
      await openCase(detail.case.id);
      await load();
      notify(`Status → ${status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const addNarrative = async () => {
    if (!detail || !narrative.trim()) return;
    try {
      await api(`/api/rms/cases/${detail.case.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "narrative", text: narrative }),
      });
      setNarrative("");
      await openCase(detail.case.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setResults((await api(`/api/rms/search?q=${encodeURIComponent(query)}`)).results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const createModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = await api("/api/rms/records", {
        method: "POST",
        body: JSON.stringify({ type: moduleType, title: moduleTitle }),
      });
      setModuleTitle("");
      notify(`Created ${json.record.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
          Records Management System
        </p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">RMS</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--cmd-fg-muted)]">
          The unified operational record system — every case, evidence item, person, vehicle, and
          record is connected through the Relationship Engine and one Timeline.
        </p>
      </header>

      {metrics ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            { label: "Open cases", value: metrics.openCases },
            { label: "Evidence queue", value: metrics.evidenceAwaitingReview },
            { label: "Court backlog", value: metrics.courtBacklog },
            { label: "Jail pop.", value: metrics.jailPopulation },
            { label: "IA cases", value: metrics.internalAffairsCases },
            {
              label: "Avg inv.",
              value:
                metrics.avgInvestigationDays === null ? "—" : `${metrics.avgInvestigationDays}d`,
            },
          ].map((c) => (
            <div key={c.label} className="cmd-glass rounded-[var(--cmd-radius)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                {c.label}
              </p>
              <p className="mt-1 text-xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-success)]/40 bg-[var(--cmd-success)]/10 px-4 py-3 text-sm">
          {flash}
        </div>
      ) : null}

      <div className="flex gap-2">
        {(["cases", "search", "modules"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "primary" : "outline"}
            onClick={() => setTab(t)}
          >
            {t === "cases" ? "Cases" : t === "search" ? "Global Search" : "Modules"}
          </Button>
        ))}
      </div>

      {tab === "cases" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-3">
            {canManageCases ? (
              <form
                onSubmit={createCase}
                className="cmd-glass flex gap-2 rounded-[var(--cmd-radius-xl)] p-3"
              >
                <Input
                  required
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  placeholder="New case title…"
                />
                <Button size="sm" type="submit">
                  Create
                </Button>
              </form>
            ) : null}
            <ul className="space-y-2">
              {cases.length === 0 ? (
                <li className="text-sm text-[var(--cmd-fg-muted)]">No cases yet.</li>
              ) : null}
              {cases.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openCase(c.id)}
                    className={`w-full rounded-[var(--cmd-radius-xl)] p-3 text-left ${detail?.case.id === c.id ? "cmd-glass-strong" : "cmd-glass hover:bg-[var(--cmd-bg-muted)]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone[c.status] ?? "neutral"}>{c.status}</Badge>
                      <span className="text-xs text-[var(--cmd-fg-muted)]">{c.number}</span>
                    </div>
                    <p className="mt-1 font-medium">{c.title}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            {custody ? (
              <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[custody.evidence.status] ?? "neutral"}>
                      {custody.evidence.status}
                    </Badge>
                    <span className="text-xs text-[var(--cmd-fg-muted)]">
                      {custody.evidence.number}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCustody(null)}>
                    Back to case
                  </Button>
                </div>
                <h2 className="mt-1 text-lg font-semibold">{custody.evidence.description}</h2>
                <p className="mt-2 text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                  Chain of custody (immutable)
                </p>
                <ol className="mt-1 space-y-1">
                  {custody.chain.map((c) => (
                    <li
                      key={c.sequence}
                      className="rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-sm"
                    >
                      <span className="font-mono text-xs text-[var(--cmd-fg-muted)]">
                        #{c.sequence}
                      </span>{" "}
                      <span className="font-medium">{c.action}</span>
                      <span className="ml-2 text-xs text-[var(--cmd-fg-muted)]">
                        {new Date(c.at).toLocaleString()}
                        {c.condition ? ` · ${c.condition}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">
                  Integrity:{" "}
                  {custody.integrity.valid ? "verified ✓" : custody.integrity.issues.join("; ")}
                </p>
                {canManageCases ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {custody.evidence.status !== "CHECKED_OUT" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => custodyAction("CHECK_OUT")}
                      >
                        Check out
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => custodyAction("RETURN")}>
                        Return
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => custodyAction("TRANSFER")}>
                      Transfer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => custodyAction("ARCHIVE")}>
                      Archive
                    </Button>
                  </div>
                ) : null}
              </article>
            ) : detail ? (
              <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[detail.case.status] ?? "neutral"}>
                    {detail.case.status}
                  </Badge>
                  <span className="text-xs text-[var(--cmd-fg-muted)]">{detail.case.number}</span>
                </div>
                <h2 className="mt-1 font-[family-name:var(--cmd-font-display)] text-2xl">
                  {detail.case.title}
                </h2>

                {canManageCases ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                      value={detail.case.status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {CASE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-[var(--cmd-fg-muted)]">change status</span>
                  </div>
                ) : null}

                {/* Evidence */}
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    Evidence ({detail.evidence.length})
                  </p>
                  <ul className="mt-1 space-y-1">
                    {detail.evidence.map((ev) => (
                      <li key={ev.id}>
                        <button
                          onClick={() => openEvidence(ev.id)}
                          className="flex w-full items-center justify-between rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--cmd-accent)]/10"
                        >
                          <span>
                            {ev.number} — {ev.description}
                          </span>
                          <Badge tone={statusTone[ev.status] ?? "neutral"}>{ev.status}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {canManageCases ? (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={evDesc}
                        onChange={(e) => setEvDesc(e.target.value)}
                        placeholder="Collect evidence (description)…"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={collectEvidence}
                        disabled={evDesc.trim().length < 2}
                      >
                        Collect
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Relationships */}
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    Relationships ({detail.relationships.length})
                  </p>
                  {detail.relationships.length === 0 ? (
                    <p className="text-sm text-[var(--cmd-fg-muted)]">No linked records yet.</p>
                  ) : null}
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {detail.relationships.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--cmd-radius-pill)] bg-[var(--cmd-bg-muted)] px-2.5 py-1 text-xs"
                      >
                        <span className="text-[var(--cmd-fg-muted)]">{r.label}:</span>{" "}
                        {r.record.number} {r.record.title}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Narrative */}
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    Narrative
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] p-2.5 font-[family-name:inherit] text-sm">
                    {detail.case.narrative || "—"}
                  </pre>
                  {canManageCases ? (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        placeholder="Add narrative entry…"
                      />
                      <Button size="sm" variant="outline" onClick={addNarrative}>
                        Add
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Timeline */}
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    Timeline
                  </p>
                  <ol className="mt-1 space-y-1">
                    {detail.timeline.map((t, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>{t.title}</span>
                        <span className="text-xs text-[var(--cmd-fg-muted)]">
                          {new Date(t.occurredAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            ) : (
              <div className="cmd-glass flex items-center justify-center rounded-[var(--cmd-radius-xl)] p-8 text-sm text-[var(--cmd-fg-muted)]">
                Select a case to view its timeline, evidence, and relationships.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="space-y-3">
          <form onSubmit={runSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases, evidence, people, vehicles, records…"
              className="max-w-md"
            />
            <Button size="sm" type="submit">
              Search
            </Button>
          </form>
          <ul className="space-y-1">
            {results.length === 0 ? (
              <li className="text-sm text-[var(--cmd-fg-muted)]">
                No results. Try a case number, name, or plate.
              </li>
            ) : null}
            {results.map((r) => (
              <li
                key={`${r.type}:${r.id}`}
                className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius)] p-3 text-sm"
              >
                <span>
                  <Badge tone="neutral">{r.type.replace(/_/g, " ")}</Badge>{" "}
                  <span className="ml-2 font-medium">{r.number}</span> — {r.title}
                </span>
                <span className="text-xs text-[var(--cmd-fg-muted)]">{r.snippet}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "modules" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Every RMS module is a connected record — Court, Jail, Detective, Internal Affairs,
            Fleet, Fire/EMS, Business, and Address. Create one and link it from any case.
          </p>
          <form
            onSubmit={createModule}
            className="cmd-glass flex flex-wrap items-end gap-2 rounded-[var(--cmd-radius-xl)] p-3"
          >
            <div>
              <Label htmlFor="mod-type">Module</Label>
              <select
                id="mod-type"
                className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                value={moduleType}
                onChange={(e) => setModuleType(e.target.value)}
              >
                {MODULE_TYPES.map((m) => (
                  <option key={m.type} value={m.type}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Label htmlFor="mod-title">Title</Label>
              <Input
                id="mod-title"
                required
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="e.g. State v. Doe / Booking / Investigation"
              />
            </div>
            <Button size="sm" type="submit">
              Create record
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Skeleton } from "@commandry/ui";

type Shift = { id: string; status: string; startedAt: string; breakMinutes: number };
type Metrics = {
  totalActiveMinutes: number;
  shiftMinutes: number;
  breakMinutes: number;
  sessionMinutes: number;
  completedShifts: number;
  sessionsAttended: number;
  hostedSessions: number;
};
type Compliance = { status: string; requiredMinutes: number; activeMinutes: number };
type TimelineEntry = {
  type: string;
  label: string;
  category: string;
  occurredAt: string;
  durationMinutes: number | null;
};
type Leader = { userId: string; name: string; activeMinutes: number };

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: unknown }).error;
    throw new Error(
      typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Request failed"),
    );
  }
  return json;
}

export function ActivityView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/activity");
      setMetrics(data.metrics);
      setCompliance(data.compliance);
      setTimeline(data.timeline);
      setActiveShift(data.activeShift);
      // Org analytics is manager-only; ignore if forbidden.
      const analytics = await api("/api/analytics/operations").catch(() => null);
      if (analytics) setLeaderboard(analytics.analytics.leaderboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftAction = async (action: string) => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/shifts", { method: "POST", body: JSON.stringify({ action }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  const complianceTone =
    compliance?.status === "met"
      ? "success"
      : compliance?.status === "at_risk"
        ? "warning"
        : "danger";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Operations</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">My Activity</h1>
      </header>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Shift</h2>
            {activeShift ? (
              <p className="text-sm text-[var(--cmd-fg-muted)]">
                {activeShift.status === "ON_BREAK" ? "On break" : "On duty"} since{" "}
                {new Date(activeShift.startedAt).toLocaleTimeString()}
                {activeShift.breakMinutes > 0 ? ` · ${fmt(activeShift.breakMinutes)} break` : ""}
              </p>
            ) : (
              <p className="text-sm text-[var(--cmd-fg-muted)]">You are off duty.</p>
            )}
          </div>
          <div className="flex gap-2">
            {!activeShift ? (
              <Button onClick={() => shiftAction("start")} disabled={busy}>
                Start shift
              </Button>
            ) : activeShift.status === "ACTIVE" ? (
              <>
                <Button variant="outline" onClick={() => shiftAction("break")} disabled={busy}>
                  Break
                </Button>
                <Button onClick={() => shiftAction("end")} disabled={busy}>
                  End shift
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => shiftAction("resume")} disabled={busy}>
                  Resume
                </Button>
                <Button onClick={() => shiftAction("end")} disabled={busy}>
                  End shift
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {compliance ? (
        <section className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius-xl)] p-5">
          <div>
            <h2 className="font-medium">Activity requirement</h2>
            <p className="text-sm text-[var(--cmd-fg-muted)]">
              {fmt(compliance.activeMinutes)} of {fmt(compliance.requiredMinutes)} this period
            </p>
          </div>
          <Badge tone={complianceTone}>{compliance.status.replace("_", " ")}</Badge>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active time", value: fmt(metrics?.totalActiveMinutes ?? 0) },
          { label: "Shift time", value: fmt(metrics?.shiftMinutes ?? 0) },
          { label: "Session time", value: fmt(metrics?.sessionMinutes ?? 0) },
          { label: "Break time", value: fmt(metrics?.breakMinutes ?? 0) },
          { label: "Completed shifts", value: String(metrics?.completedShifts ?? 0) },
          { label: "Sessions attended", value: String(metrics?.sessionsAttended ?? 0) },
          { label: "Sessions hosted", value: String(metrics?.hostedSessions ?? 0) },
        ].map((card) => (
          <div key={card.label} className="cmd-glass rounded-[var(--cmd-radius)] p-4">
            <p className="text-xs text-[var(--cmd-fg-muted)]">{card.label}</p>
            <p className="mt-1 text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
        <h2 className="font-medium">Participation history</h2>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--cmd-fg-muted)]">
            No participation events yet. Start a shift to begin.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {timeline.map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-[var(--cmd-border)]/40 pb-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--cmd-fg-muted)]">
                    {new Date(entry.occurredAt).toLocaleString()}
                  </span>
                  <span>{entry.label}</span>
                </div>
                {entry.durationMinutes != null ? (
                  <span className="text-xs text-[var(--cmd-fg-muted)]">
                    {fmt(entry.durationMinutes)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {leaderboard.length > 0 ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
          <h2 className="font-medium">Team leaderboard (7 days)</h2>
          <ol className="mt-3 space-y-1.5">
            {leaderboard.map((l, i) => (
              <li key={l.userId} className="flex items-center justify-between text-sm">
                <span>
                  {i + 1}. {l.name}
                </span>
                <span className="text-[var(--cmd-fg-muted)]">{fmt(l.activeMinutes)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

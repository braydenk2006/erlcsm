"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Kpi = {
  key: string;
  label: string;
  unit: string;
  current: number;
  previous: number | null;
  target: number;
  severity: string;
  trend: { type: string; explanation: string };
  onTarget: boolean;
  evidence: string;
};
type Insight = {
  key: string;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  recommendation: string | null;
  evidence: string;
};
type Rec = {
  key: string;
  severity: string;
  text: string;
  reason: string;
  actions: { key: string; label: string; href: string }[];
};
type Alert = { id: string; level: string; title: string; body: string | null; status: string };
type HealthCat = { key: string; label: string; score: number };
type Goal = {
  id: string;
  name: string;
  metricKey: string;
  target: number;
  current: number;
  progress: number;
  onTarget: boolean;
  trend: string;
  severity: string;
  estimatedDaysToTarget: number | null;
  recommendation: string;
};
type Bundle = {
  kpis: Kpi[];
  insights: Insight[];
  recommendations: Rec[];
  alerts: Alert[];
  communityHealth: { overall: number; severity: string; trend: string; categories: HealthCat[] };
  executiveSummary: { text: string; severity: string }[];
};

const sevTone: Record<string, "success" | "warning" | "danger" | "accent" | "neutral"> = {
  excellent: "success",
  healthy: "success",
  attention: "accent",
  warning: "warning",
  critical: "danger",
};
const fmt = (unit: string, v: number) =>
  unit === "ratio" || unit === "percent"
    ? `${Math.round(v * 100)}%`
    : unit === "hours"
      ? `${Math.round(v * 10) / 10}h`
      : `${Math.round(v)}`;

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

export function InsightsView() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, g] = await Promise.all([api("/api/insights"), api("/api/goals")]);
      setBundle(b);
      setGoals(g.goals);
      if (!metricKey && b.kpis?.[0]) setMetricKey(b.kpis[0].key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [metricKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({ name, metricKey, target: Number(target) }),
      });
      setName("");
      setTarget("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    }
  };
  const removeGoal = (id: string) =>
    api(`/api/goals/${id}`, { method: "DELETE" })
      .then(load)
      .catch((e) => setError(e.message));
  const alertAction = (id: string, status: string) =>
    api(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      .then(load)
      .catch((e) => setError(e.message));

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!bundle) return <p className="text-sm text-[var(--cmd-fg-muted)]">{error ?? "No data."}</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
          Insights &amp; Recommendations
        </p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">Intelligence</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--cmd-fg-muted)]">
          Deterministic, explainable insights from platform data. No AI — every recommendation is
          backed by measurable evidence.
        </p>
      </header>
      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="cmd-glass-strong rounded-[var(--cmd-radius-xl)] p-5">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold">{bundle.communityHealth.overall}</span>
          <Badge tone={sevTone[bundle.communityHealth.severity] ?? "neutral"}>
            {bundle.communityHealth.severity}
          </Badge>
          <span className="text-xs text-[var(--cmd-fg-muted)]">
            Community Health · trend {bundle.communityHealth.trend}
          </span>
        </div>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {bundle.communityHealth.categories.map((c) => (
            <li
              key={c.key}
              className="flex items-center justify-between rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-sm"
            >
              <span>{c.label}</span>
              <Badge tone={c.score >= 75 ? "success" : c.score >= 60 ? "accent" : "warning"}>
                {c.score}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Key Metrics</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {bundle.kpis.map((k) => (
              <li
                key={k.key}
                className="flex items-center justify-between rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-sm"
                title={`Target ${fmt(k.unit, k.target)} · ${k.trend.explanation}`}
              >
                <span className="truncate">{k.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--cmd-fg-muted)]">
                    {k.trend.type.includes("improv")
                      ? "↑"
                      : k.trend.type.includes("declin")
                        ? "↓"
                        : "→"}
                  </span>
                  <Badge tone={sevTone[k.severity] ?? "neutral"}>{fmt(k.unit, k.current)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Recommendations</h2>
          {bundle.recommendations.length === 0 ? (
            <p className="text-sm text-[var(--cmd-fg-muted)]">
              Everything is on target — no recommendations.
            </p>
          ) : null}
          <ul className="space-y-2">
            {bundle.recommendations.map((r) => (
              <li
                key={r.key}
                className="rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] p-2.5"
              >
                <div className="flex items-start gap-2 text-sm">
                  <Badge tone={sevTone[r.severity] ?? "neutral"}>{r.severity}</Badge>
                  <div>
                    <p>{r.text}</p>
                    <p className="mt-0.5 text-xs text-[var(--cmd-fg-muted)]">Because: {r.reason}</p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.actions.map((a) => (
                    <Button key={a.key} size="sm" variant="outline" asChild>
                      <Link href={a.href}>{a.label}</Link>
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Alerts</h2>
        {bundle.alerts.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No active alerts.</p>
        ) : null}
        <ul className="space-y-2">
          {bundle.alerts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <Badge
                  tone={
                    a.level === "critical" ? "danger" : a.level === "warning" ? "warning" : "accent"
                  }
                >
                  {a.level}
                </Badge>
                {a.title}
                <span className="text-xs text-[var(--cmd-fg-muted)]">({a.status})</span>
              </span>
              <span className="flex gap-1.5">
                {a.status === "open" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alertAction(a.id, "acknowledged")}
                  >
                    Acknowledge
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => alertAction(a.id, "resolved")}>
                  Resolve
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Goals</h2>
        <form onSubmit={createGoal} className="mb-4 grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <Label htmlFor="g-name">Goal</Label>
            <Input
              id="g-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Attendance 90%"
            />
          </div>
          <div>
            <Label htmlFor="g-metric">Metric</Label>
            <select
              id="g-metric"
              className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
            >
              {bundle.kpis.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="g-target">Target</Label>
            <Input
              id="g-target"
              required
              type="number"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0.9"
            />
          </div>
          <Button type="submit">Create goal</Button>
        </form>
        {goals.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No goals yet.</p>
        ) : null}
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--cmd-fg-muted)]">
                  {Math.round(g.progress * 100)}%
                  {g.estimatedDaysToTarget !== null
                    ? ` · ~${g.estimatedDaysToTarget}d to target`
                    : ""}
                  <button className="hover:underline" onClick={() => removeGoal(g.id)}>
                    remove
                  </button>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--cmd-bg-muted)]">
                <div
                  className={`h-full rounded-full ${g.onTarget ? "bg-[var(--cmd-success)]" : g.severity === "critical" || g.severity === "warning" ? "bg-[var(--cmd-warning)]" : "bg-[var(--cmd-accent)]"}`}
                  style={{ width: `${Math.round(g.progress * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-[var(--cmd-fg-muted)]">{g.recommendation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Insight timeline</h2>
        {bundle.insights.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No notable changes.</p>
        ) : null}
        <ul className="space-y-1.5">
          {bundle.insights.map((i) => (
            <li key={i.key} className="text-sm" title={i.evidence}>
              <Badge tone={sevTone[i.severity] ?? "neutral"}>{i.severity}</Badge> {i.title}
              {i.recommendation ? (
                <span className="text-[var(--cmd-fg-muted)]"> — {i.recommendation}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

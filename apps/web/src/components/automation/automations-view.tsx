"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Automation = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  enabled: boolean;
  isBuiltIn: boolean;
  actions: { type: string }[];
};
type Run = {
  id: string;
  automationName: string;
  eventType: string;
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
};
type Analytics = {
  totalRuns: number;
  byStatus: Record<string, number>;
  successRate: number;
  avgDurationMs: number;
  enabledAutomations: number;
  topTriggers: { trigger: string; count: number }[];
};

const TRIGGERS = [
  "Announcement.Published",
  "Application.Approved",
  "Shift.Completed",
  "Training.Completed",
  "Website.Published",
  "Member.Created",
  "Session.Completed",
  "CAD.ReportApproved",
];
const ACTIONS = [
  "send_notification",
  "webhook",
  "execute_server_command",
  "refresh_sitemap",
  "create_task",
];

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

const statusTone = (s: string) =>
  s === "COMPLETED"
    ? "success"
    : s === "FAILED"
      ? "danger"
      : s === "RETRYING"
        ? "warning"
        : "neutral";

export function AutomationsView() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(TRIGGERS[0]);
  const [actionType, setActionType] = useState(ACTIONS[0]);
  const [actionTitle, setActionTitle] = useState("Automated notification");

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api("/api/automations"), api("/api/automations/runs")]);
      setAutomations(a.automations);
      setRuns(r.runs);
      setAnalytics(r.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (t: string) => {
    setMessage(t);
    setTimeout(() => setMessage(null), 3000);
  };

  const toggle = (a: Automation) =>
    api(`/api/automations/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !a.enabled }),
    })
      .then(() => load())
      .catch((e) => setError(e.message));
  const remove = (a: Automation) =>
    api(`/api/automations/${a.id}`, { method: "DELETE" })
      .then(() => load())
      .catch((e) => setError(e.message));
  const runNow = () =>
    api("/api/automations/runs", { method: "POST" })
      .then((r) => {
        flash(`Processed ${r.processed} run(s).`);
        void load();
      })
      .catch((e) => setError(e.message));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const config: Record<string, unknown> =
        actionType === "send_notification"
          ? { title: actionTitle, allMembers: true }
          : actionType === "execute_server_command"
            ? { command: ":h " + actionTitle }
            : { title: actionTitle };
      await api("/api/automations", {
        method: "POST",
        body: JSON.stringify({ name, trigger, actions: [{ type: actionType, config }] }),
      });
      setName("");
      flash("Automation created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
            Automation Platform
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Automations</h1>
        </div>
        <Button size="sm" variant="outline" onClick={runNow}>
          Run due now
        </Button>
      </header>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-success)]/40 bg-[var(--cmd-success)]/10 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {analytics ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Enabled", value: analytics.enabledAutomations },
            { label: "Total runs", value: analytics.totalRuns },
            { label: "Success rate", value: `${Math.round(analytics.successRate * 100)}%` },
            { label: "Avg time", value: `${analytics.avgDurationMs}ms` },
          ].map((c) => (
            <div key={c.label} className="cmd-glass rounded-[var(--cmd-radius)] p-4">
              <p className="text-xs text-[var(--cmd-fg-muted)]">{c.label}</p>
              <p className="mt-1 text-xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="font-medium">New automation</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4 md:items-end">
          <div className="md:col-span-1">
            <Label htmlFor="a-name">Name</Label>
            <Input
              id="a-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Notify on approval"
            />
          </div>
          <div>
            <Label htmlFor="a-trigger">When (trigger)</Label>
            <select
              id="a-trigger"
              className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="a-action">Then (action)</Label>
            <select
              id="a-action"
              className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="a-title">Message / value</Label>
            <Input
              id="a-title"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" className="mt-3">
          Create automation
        </Button>
      </form>

      <section>
        <h2 className="mb-2 font-medium">Automations</h2>
        <ul className="space-y-2">
          {automations.map((a) => (
            <li
              key={a.id}
              className="cmd-glass flex flex-wrap items-center justify-between gap-2 rounded-[var(--cmd-radius-xl)] p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "on" : "off"}</Badge>
                  {a.isBuiltIn ? (
                    <span className="text-xs text-[var(--cmd-fg-muted)]">built-in</span>
                  ) : null}
                  <span className="font-medium">{a.name}</span>
                </div>
                <p className="text-xs text-[var(--cmd-fg-muted)]">
                  when {a.trigger} → {a.actions.map((x) => x.type.replace(/_/g, " ")).join(", ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={a.enabled ? "outline" : "primary"}
                  onClick={() => toggle(a)}
                >
                  {a.enabled ? "Disable" : "Enable"}
                </Button>
                {!a.isBuiltIn ? (
                  <Button size="sm" variant="ghost" onClick={() => remove(a)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            No runs yet. Enable an automation, then trigger its event.
          </p>
        ) : (
          <ul className="space-y-1">
            {runs.map((r) => (
              <li
                key={r.id}
                className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius)] p-3 text-sm"
              >
                <span>
                  <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge>{" "}
                  {r.automationName}
                  <span className="ml-2 text-xs text-[var(--cmd-fg-muted)]">on {r.eventType}</span>
                </span>
                <span className="text-xs text-[var(--cmd-fg-muted)]">
                  {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                  {r.error ? ` · ${r.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

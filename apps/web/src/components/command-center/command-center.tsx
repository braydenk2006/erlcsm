"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Plus, RotateCcw } from "lucide-react";
import { Badge, Button } from "@commandry/ui";

type Size = "sm" | "md" | "lg";
type LayoutItem = { key: string; hidden: boolean; order: number; size: Size };
type Action = { key: string; label: string; href: string; icon: string };
type SummaryLine = { text: string; severity: string };
type Payload = {
  generatedAt: string;
  widgets: { key: string; title: string; category: string; defaultSize: string }[];
  layout: LayoutItem[];
  quickActions: Action[];
  executiveSummary: SummaryLine[];
  data: Record<string, unknown>;
};

const sevTone: Record<string, "success" | "warning" | "danger" | "accent" | "neutral"> = {
  excellent: "success",
  healthy: "success",
  attention: "accent",
  warning: "warning",
  critical: "danger",
};

const num = (v: unknown) => (typeof v === "number" ? v : 0);

export function CommandCenter({ initial, orgName }: { initial: Payload; orgName: string }) {
  const [payload, setPayload] = useState<Payload>(initial);
  const [layout, setLayout] = useState<LayoutItem[]>(initial.layout);
  const [customizing, setCustomizing] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dashboard", { headers: { "content-type": "application/json" } });
    if (res.ok) {
      const json = (await res.json()) as Payload;
      setPayload(json);
      setLayout(json.layout);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const persist = useCallback(async (next: LayoutItem[]) => {
    const ordered = next.map((item, idx) => ({ ...item, order: idx }));
    setLayout(ordered);
    await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: ordered }),
    });
  }, []);

  const move = (key: string, dir: -1 | 1) => {
    const visible = layout.filter((l) => !l.hidden);
    const idx = visible.findIndex((l) => l.key === key);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= visible.length) return;
    const reordered = [...visible];
    [reordered[idx], reordered[swap]] = [reordered[swap]!, reordered[idx]!];
    void persist([...reordered, ...layout.filter((l) => l.hidden)]);
  };
  const setHidden = (key: string, hidden: boolean) =>
    void persist(layout.map((l) => (l.key === key ? { ...l, hidden } : l)));
  const reset = async () => {
    await fetch("/api/dashboard", { method: "DELETE" });
    await refresh();
  };

  const titleFor = (key: string) => payload.widgets.find((w) => w.key === key)?.title ?? key;
  const visible = useMemo(
    () => layout.filter((l) => !l.hidden).sort((a, b) => a.order - b.order),
    [layout],
  );
  const hidden = useMemo(() => layout.filter((l) => l.hidden), [layout]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
            Command Center
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl tracking-[-0.02em]">
            {orgName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={customizing ? "primary" : "outline"}
            onClick={() => setCustomizing((c) => !c)}
          >
            {customizing ? "Done" : "Customize"}
          </Button>
          {customizing ? (
            <Button size="sm" variant="ghost" onClick={reset} aria-label="Reset layout">
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
          ) : null}
        </div>
      </header>

      {customizing && hidden.length > 0 ? (
        <section
          className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4"
          aria-label="Hidden widgets"
        >
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
            Hidden widgets
          </p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((h) => (
              <Button
                key={h.key}
                size="sm"
                variant="outline"
                onClick={() => setHidden(h.key, false)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {titleFor(h.key)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const span = item.size === "lg" ? "md:col-span-2" : "";
          return (
            <section
              key={item.key}
              className={`cmd-glass motion-reduce:transition-none flex flex-col rounded-[var(--cmd-radius-xl)] p-4 ${span}`}
              aria-label={titleFor(item.key)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{titleFor(item.key)}</h2>
                {customizing ? (
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded p-1 hover:bg-[var(--cmd-bg-muted)]"
                      aria-label={`Move ${titleFor(item.key)} up`}
                      onClick={() => move(item.key, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-[var(--cmd-bg-muted)]"
                      aria-label={`Move ${titleFor(item.key)} down`}
                      onClick={() => move(item.key, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-[var(--cmd-bg-muted)]"
                      aria-label={`Hide ${titleFor(item.key)}`}
                      onClick={() => setHidden(item.key, true)}
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex-1">
                <Widget
                  k={item.key}
                  data={payload.data[item.key]}
                  summary={payload.executiveSummary}
                  quickActions={payload.quickActions}
                />
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-center text-xs text-[var(--cmd-fg-muted)]">
        Updated {new Date(payload.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">{label}</p>
      <p className={`text-lg font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Widget({
  k,
  data,
  summary,
  quickActions,
}: {
  k: string;
  data: unknown;
  summary: SummaryLine[];
  quickActions: Action[];
}) {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (k) {
    case "community_health": {
      const h = d as {
        overall: number;
        severity: string;
        trend: string;
        factors: {
          key: string;
          label: string;
          score: number;
          severity: string;
          value: string;
          recommendedAction: string;
          trend: string;
        }[];
      };
      return (
        <div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold">{h.overall}</span>
            <Badge tone={sevTone[h.severity] ?? "neutral"}>{h.severity}</Badge>
            <span className="text-xs text-[var(--cmd-fg-muted)]">trend {h.trend}</span>
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {(h.factors ?? []).map((f) => (
              <li
                key={f.key}
                className="flex items-center justify-between gap-2 rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5"
                title={f.recommendedAction}
              >
                <span className="truncate text-xs">{f.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--cmd-fg-muted)]">{f.value}</span>
                  <Badge tone={sevTone[f.severity] ?? "neutral"}>{f.score}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "executive_summary":
      return (
        <ul className="space-y-1.5">
          {summary.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.severity === "critical" ? "bg-[var(--cmd-danger)]" : l.severity === "warning" ? "bg-[var(--cmd-warning)]" : l.severity === "attention" ? "bg-[var(--cmd-accent)]" : "bg-[var(--cmd-success)]"}`}
              />
              {l.text}
            </li>
          ))}
        </ul>
      );
    case "quick_actions":
      return (
        <div className="flex flex-wrap gap-2">
          {quickActions.length === 0 ? (
            <p className="text-sm text-[var(--cmd-fg-muted)]">No quick actions available.</p>
          ) : null}
          {quickActions.map((a) => (
            <Button key={a.key} size="sm" variant="outline" asChild>
              <Link href={a.href}>{a.label}</Link>
            </Button>
          ))}
        </div>
      );
    case "notifications": {
      const n = d as {
        items: {
          id: string;
          title: string;
          body: string | null;
          linkUrl: string | null;
          readAt: string | null;
        }[];
        unread: number;
      };
      return (
        <div>
          <p className="mb-2 text-xs text-[var(--cmd-fg-muted)]">{n.unread} unread</p>
          <ul className="space-y-1.5">
            {(n.items ?? []).slice(0, 6).map((item) => (
              <li key={item.id} className="text-sm">
                <Link href={item.linkUrl ?? "#"} className="hover:underline">
                  <span className={item.readAt ? "text-[var(--cmd-fg-muted)]" : "font-medium"}>
                    {item.title}
                  </span>
                </Link>
              </li>
            ))}
            {(n.items ?? []).length === 0 ? (
              <li className="text-sm text-[var(--cmd-fg-muted)]">No notifications.</li>
            ) : null}
          </ul>
        </div>
      );
    }
    case "live_server": {
      if (!d || (d as { online?: boolean }).online === undefined)
        return (
          <p className="text-sm text-[var(--cmd-fg-muted)]">Server integration unavailable.</p>
        );
      const s = d as { online: boolean; currentPlayers: number; maxPlayers: number; queue: number };
      return (
        <div>
          <Badge tone={s.online ? "success" : "danger"}>{s.online ? "online" : "offline"}</Badge>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Players" value={`${s.currentPlayers}/${s.maxPlayers}`} />
            <Stat label="Queue" value={s.queue} />
            <Stat label="Status" value={s.online ? "Up" : "Down"} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link href="/app/live">Open Server Management</Link>
          </Button>
        </div>
      );
    }
    case "upcoming_operations": {
      const ops =
        (data as {
          title: string;
          start: string;
          status: string;
          shiftType: string;
          publicId: string;
          hasHost: boolean;
        }[]) ?? [];
      if (ops.length === 0)
        return <p className="text-sm text-[var(--cmd-fg-muted)]">No upcoming operations.</p>;
      return (
        <ul className="space-y-2">
          {ops.slice(0, 5).map((op) => {
            const mins = Math.round((new Date(op.start).getTime() - Date.now()) / 60000);
            return (
              <li
                key={op.publicId}
                className="flex items-center justify-between gap-2 rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-sm"
              >
                <span className="truncate">
                  <span className="font-medium">{op.title}</span>
                  <span className="ml-2 text-xs text-[var(--cmd-fg-muted)]">{op.shiftType}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--cmd-fg-muted)]">
                  {mins <= 0 ? "now" : mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}
                </span>
              </li>
            );
          })}
        </ul>
      );
    }
    case "pending_applications": {
      const p = d as { total: number; assignedToMe: number; todaySubmissions: number };
      return (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={num(p.total)} />
            <Stat label="Assigned to me" value={num(p.assignedToMe)} />
            <Stat label="Today" value={num(p.todaySubmissions)} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link href="/app/applications">Review</Link>
          </Button>
        </div>
      );
    }
    case "training_progress": {
      const t = d as {
        completed: number;
        assigned: number;
        pct: number;
        recentCompletions: number;
      };
      return (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Completion" value={`${num(t.pct)}%`} />
            <Stat label="Completed" value={num(t.completed)} />
            <Stat label="Recent" value={num(t.recentCompletions)} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link href="/app/training">View progress</Link>
          </Button>
        </div>
      );
    }
    case "workflow_queue": {
      const w = d as {
        pending: number;
        revisions: number;
        assignedToMe: number;
        completedToday: number;
      };
      return (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pending" value={num(w.pending)} />
          <Stat label="Revisions" value={num(w.revisions)} />
          <Stat label="Assigned to me" value={num(w.assignedToMe)} />
          <Stat label="Completed today" value={num(w.completedToday)} />
        </div>
      );
    }
    case "automation_health": {
      const a = d as {
        executedToday: number;
        successRate: number;
        failed: number;
        retrying: number;
        queued: number;
        avgDurationMs: number;
      };
      return (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Today" value={num(a.executedToday)} />
            <Stat label="Success" value={`${Math.round(num(a.successRate) * 100)}%`} />
            <Stat
              label="Failed"
              value={num(a.failed)}
              tone={num(a.failed) > 0 ? "text-[var(--cmd-danger)]" : undefined}
            />
            <Stat label="Retrying" value={num(a.retrying)} />
            <Stat label="Queued" value={num(a.queued)} />
            <Stat label="Avg" value={`${num(a.avgDurationMs)}ms`} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link href="/app/automations">View failures</Link>
          </Button>
        </div>
      );
    }
    case "website_activity": {
      const w = d as { viewsLast7d: number };
      return <Stat label="Views (7 days)" value={num(w.viewsLast7d)} />;
    }
    case "department_status": {
      const depts =
        (data as { id: string; name: string; staffCount: number; understaffed: boolean }[]) ?? [];
      if (depts.length === 0)
        return <p className="text-sm text-[var(--cmd-fg-muted)]">No departments yet.</p>;
      return (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {depts.map((dep) => (
            <li
              key={dep.id}
              className="flex items-center justify-between rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-2.5 py-1.5 text-sm"
            >
              <span className="truncate">{dep.name}</span>
              <Badge tone={dep.understaffed ? "warning" : "success"}>{dep.staffCount}</Badge>
            </li>
          ))}
        </ul>
      );
    }
    case "event_feed": {
      const feed = (data as { type: string; at: string }[]) ?? [];
      if (feed.length === 0)
        return <p className="text-sm text-[var(--cmd-fg-muted)]">No recent activity.</p>;
      return (
        <ul className="space-y-1">
          {feed.slice(0, 8).map((e, i) => (
            <li key={i} className="flex items-center justify-between text-xs">
              <span>{e.type}</span>
              <span className="text-[var(--cmd-fg-muted)]">
                {new Date(e.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <p className="text-sm text-[var(--cmd-fg-muted)]">—</p>;
  }
}

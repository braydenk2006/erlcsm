"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";
import { ShiftDetail } from "@/components/operations/shift-detail";

type Shift = {
  id: string;
  title: string;
  shiftType: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  hostMembershipId: string | null;
  discordState: string;
};
type Analytics = {
  scheduled: number;
  claimed: number;
  unclaimed: number;
  completed: number;
  cancelled: number;
  missed: number;
  claimRate: number;
  prcAssistedMatches: number;
};

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

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleView({
  canManage,
  members,
}: {
  canManage: boolean;
  members: { membershipId: string; name: string }[];
}) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const start = new Date();
  start.setMinutes(0, 0, 0);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(toLocalInput(new Date(start.getTime() + 3600_000)));
  const [endAt, setEndAt] = useState(toLocalInput(new Date(start.getTime() + 3 * 3600_000)));
  const [erlcServer, setErlcServer] = useState("");
  const [claimPolicy, setClaimPolicy] = useState("FIRST_ELIGIBLE");
  const [prcSyncPolicy, setPrcSyncPolicy] = useState("SUGGEST_ONLY");

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api("/api/schedule"),
        api("/api/schedule/analytics").catch(() => null),
      ]);
      setShifts(s.shifts);
      if (a) setAnalytics(a.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (t: string) => {
    setMessage(t);
    setTimeout(() => setMessage(null), 3500);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/schedule", {
        method: "POST",
        body: JSON.stringify({
          title,
          scheduledStart: new Date(startAt).toISOString(),
          scheduledEnd: new Date(endAt).toISOString(),
          erlcServer: erlcServer || null,
          claimPolicy,
          prcSyncPolicy,
        }),
      });
      setTitle("");
      flash("Shift scheduled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  const unstaffed = shifts.filter(
    (s) => !s.hostMembershipId && ["OPEN_CLAIMING", "DRAFT", "NO_HOST"].includes(s.status),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Operations</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Schedule</h1>
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
            { label: "Scheduled", value: analytics.scheduled },
            { label: "Claimed", value: analytics.claimed },
            { label: "Completed", value: analytics.completed },
            { label: "Missed", value: analytics.missed },
            { label: "Unclaimed", value: analytics.unclaimed },
            { label: "Cancelled", value: analytics.cancelled },
            { label: "Claim rate", value: `${Math.round(analytics.claimRate * 100)}%` },
            { label: "PRC-assisted", value: analytics.prcAssistedMatches },
          ].map((c) => (
            <div key={c.label} className="cmd-glass rounded-[var(--cmd-radius)] p-4">
              <p className="text-xs text-[var(--cmd-fg-muted)]">{c.label}</p>
              <p className="mt-1 text-xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {unstaffed.length > 0 ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-warning)]/40 bg-[var(--cmd-warning)]/10 px-4 py-3 text-sm">
          {unstaffed.length} unstaffed shift{unstaffed.length === 1 ? "" : "s"} need a host.
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <h2 className="font-medium">Schedule a shift</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="s-title">Title</Label>
              <Input
                id="s-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Evening Patrol"
              />
            </div>
            <div>
              <Label htmlFor="s-start">Start</Label>
              <Input
                id="s-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="s-end">End</Label>
              <Input
                id="s-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="s-server">ER:LC server (optional)</Label>
              <Input
                id="s-server"
                value={erlcServer}
                onChange={(e) => setErlcServer(e.target.value)}
                placeholder="Main Server"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="s-claim">Claiming</Label>
                <select
                  id="s-claim"
                  className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                  value={claimPolicy}
                  onChange={(e) => setClaimPolicy(e.target.value)}
                >
                  <option value="FIRST_ELIGIBLE">First eligible</option>
                  <option value="APPROVAL_REQUIRED">Approval required</option>
                  <option value="ASSIGNED_ONLY">Assigned only</option>
                </select>
              </div>
              <div>
                <Label htmlFor="s-prc">PRC sync</Label>
                <select
                  id="s-prc"
                  className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                  value={prcSyncPolicy}
                  onChange={(e) => setPrcSyncPolicy(e.target.value)}
                >
                  <option value="SUGGEST_ONLY">Suggest only</option>
                  <option value="AUTO_CHECKIN">Auto check-in</option>
                  <option value="AUTO_PRESENT">Auto present</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            </div>
          </div>
          <Button type="submit" className="mt-3">
            Schedule shift
          </Button>
        </form>
      ) : null}

      {shifts.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--cmd-fg-muted)]">
          No scheduled shifts yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {shifts.map((s) => (
            <li key={s.id} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      s.status === "COMPLETED"
                        ? "success"
                        : s.status === "CANCELLED" || s.status === "MISSED"
                          ? "neutral"
                          : "accent"
                    }
                  >
                    {s.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-[var(--cmd-fg-muted)]">
                      {new Date(s.scheduledStart).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  {expanded === s.id ? "Hide" : "Manage"}
                </Button>
              </div>
              {expanded === s.id ? (
                <div className="mt-4 border-t border-[var(--cmd-border)]/50 pt-4">
                  <ShiftDetail
                    shiftId={s.id}
                    members={members}
                    canManage={canManage}
                    onChanged={() => void load()}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

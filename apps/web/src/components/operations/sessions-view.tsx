"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Session = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledFor: string | null;
};
type Attendance = { membershipId: string; name: string; status: string; minutes: number };

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

const NEXT: Record<string, { label: string; to: string }[]> = {
  DRAFT: [{ label: "Open", to: "OPEN" }],
  SCHEDULED: [{ label: "Open", to: "OPEN" }],
  OPEN: [{ label: "Start", to: "ACTIVE" }],
  ACTIVE: [{ label: "Complete", to: "COMPLETED" }],
};

export function SessionsView({ canManage }: { canManage: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/sessions");
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
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

  const openDetail = async (id: string) => {
    setSelected(id);
    try {
      const data = await api(`/api/sessions/${id}`);
      setAttendance(data.attendance);
    } catch {
      setAttendance([]);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/sessions", { method: "POST", body: JSON.stringify({ title }) });
      setTitle("");
      flash("Session drafted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const transition = async (id: string, to: string) => {
    await api(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "transition", to }),
    })
      .then(() => {
        flash(`Session → ${to.toLowerCase()}.`);
        void load();
        if (selected === id) void openDetail(id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  };

  const register = async (id: string) => {
    await api(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "register" }),
    })
      .then(() => {
        flash("Registered.");
        if (selected === id) void openDetail(id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  };

  const mark = async (id: string, membershipId: string, status: string) => {
    await api(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "attendance", membershipId, status, minutes: 60 }),
    })
      .then(() => openDetail(id))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Operations</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Sessions</h1>
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

      {canManage ? (
        <form
          onSubmit={create}
          className="cmd-glass flex flex-wrap items-end gap-3 rounded-[var(--cmd-radius-xl)] p-4"
        >
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="session-title">New session</Label>
            <Input
              id="session-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly patrol training"
            />
          </div>
          <Button type="submit">Create draft</Button>
        </form>
      ) : null}

      {sessions.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--cmd-fg-muted)]">No sessions yet.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        s.status === "COMPLETED"
                          ? "success"
                          : s.status === "CANCELLED"
                            ? "neutral"
                            : "accent"
                      }
                    >
                      {s.status.toLowerCase()}
                    </Badge>
                    <h3 className="font-medium">{s.title}</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.status === "OPEN" ? (
                    <Button size="sm" variant="outline" onClick={() => register(s.id)}>
                      Register
                    </Button>
                  ) : null}
                  {canManage &&
                    (NEXT[s.status] ?? []).map((n) => (
                      <Button key={n.to} size="sm" onClick={() => transition(s.id, n.to)}>
                        {n.label}
                      </Button>
                    ))}
                  {canManage && s.status !== "COMPLETED" && s.status !== "CANCELLED" ? (
                    <Button size="sm" variant="ghost" onClick={() => transition(s.id, "CANCELLED")}>
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (selected === s.id ? setSelected(null) : openDetail(s.id))}
                  >
                    {selected === s.id ? "Hide" : "Attendance"}
                  </Button>
                </div>
              </div>

              {selected === s.id ? (
                <div className="mt-4 border-t border-[var(--cmd-border)]/50 pt-3">
                  {attendance.length === 0 ? (
                    <p className="text-sm text-[var(--cmd-fg-muted)]">
                      No attendees registered yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {attendance.map((a) => (
                        <li
                          key={a.membershipId}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {a.name} ·{" "}
                            <span className="text-[var(--cmd-fg-muted)]">
                              {a.status.toLowerCase()}
                            </span>
                          </span>
                          {canManage && (s.status === "ACTIVE" || s.status === "OPEN") ? (
                            <div className="flex gap-1">
                              {["PRESENT", "LATE", "ABSENT"].map((st) => (
                                <Button
                                  key={st}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => mark(s.id, a.membershipId, st)}
                                >
                                  {st.toLowerCase()}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

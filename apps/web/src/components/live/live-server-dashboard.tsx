"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  Loader2,
  MapPin,
  PhoneCall,
  RefreshCw,
  Send,
  Skull,
  Terminal,
  Users,
  LogIn,
} from "lucide-react";
import { Badge, Button, Input, cn } from "@commandry/ui";
import { ErlcMap } from "./erlc-map";
import type { PlayerView, SnapshotResponse } from "./types";

const TABS = [
  { key: "players", label: "Players", icon: Users },
  { key: "map", label: "Map", icon: MapPin },
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "joins", label: "Join / Leave", icon: LogIn },
  { key: "kills", label: "Kill Logs", icon: Skull },
  { key: "commands", label: "Command Logs", icon: Terminal },
  { key: "calls", label: "911 Calls", icon: PhoneCall },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TEAM_DOT: Record<string, string> = {
  Police: "#3B6CFF",
  Sheriff: "#F5A623",
  Fire: "#EF4444",
  DOT: "#F97316",
  Civilian: "#9AA4BF",
  Jail: "#A855F7",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function WantedStars({ stars }: { stars: number | null }) {
  if (!stars || stars <= 0) return <span className="text-[var(--cmd-fg-muted)]">—</span>;
  return (
    <span className="text-[#F5A623]" title={`${stars} wanted stars`}>
      {"★".repeat(stars)}
      <span className="text-[var(--cmd-border)]">{"★".repeat(Math.max(0, 5 - stars))}</span>
    </span>
  );
}

function TeamTag({ team }: { team: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: TEAM_DOT[team] ?? "#9AA4BF" }}
      />
      {team}
    </span>
  );
}

type CommandEntry = { command: string; message: string; ok: boolean };

export function LiveServerDashboard() {
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("players");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/erlc/snapshot", { cache: "no-store" });
      const json = (await res.json()) as SnapshotResponse;
      setData(json);
    } catch {
      // network hiccup — keep last known data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (autoRefresh) {
      timer.current = setInterval(() => void fetchSnapshot(), 5000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [autoRefresh, fetchSnapshot]);

  const sendCommand = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch("/api/erlc/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        result?: { message: string };
        error?: string;
      };
      setHistory((prev) =>
        [
          {
            command: trimmed,
            ok: Boolean(json.ok),
            message: json.result?.message ?? json.error ?? "No response",
          },
          ...prev,
        ].slice(0, 8),
      );
      setCommand("");
    } catch {
      setHistory((prev) => [{ command: trimmed, ok: false, message: "Request failed" }, ...prev]);
    } finally {
      setSending(false);
    }
  }, [command]);

  if (loading && !data) {
    return (
      <div className="cmd-glass flex items-center gap-3 rounded-[var(--cmd-radius-xl)] p-8 text-[var(--cmd-fg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Connecting to live server…
      </div>
    );
  }

  const snapshot = data?.snapshot ?? null;
  const outage = data && !data.ok ? (data.outage?.message ?? "ER:LC service unavailable") : null;

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{snapshot?.status.name ?? "ER:LC Server"}</h2>
              <Badge tone={data?.mode === "live" ? "success" : "accent"}>
                {data?.mode === "live" ? "Live" : "Simulator"}
              </Badge>
              {snapshot ? (
                <Badge tone={snapshot.status.connected ? "success" : "danger"}>
                  {snapshot.status.connected ? "Connected" : "Offline"}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-[var(--cmd-fg-muted)]">
              {snapshot?.status.message ?? outage ?? "Awaiting server data"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void fetchSnapshot()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat
            label="Players"
            value={
              snapshot ? `${snapshot.status.currentPlayers}/${snapshot.status.maxPlayers}` : "—"
            }
          />
          <Stat label="Queue" value={snapshot ? String(snapshot.queue.length) : "—"} />
          <Stat label="Region" value={snapshot?.status.region ?? "—"} />
          <Stat
            label="Uptime"
            value={
              snapshot?.status.uptimeSeconds != null
                ? `${Math.floor(snapshot.status.uptimeSeconds / 3600)}h`
                : "—"
            }
          />
          <Stat label="Join key" value={snapshot?.status.joinKey ?? "—"} mono />
          <Stat label="Integration" value={data?.integration.status ?? "—"} />
        </div>

        {outage ? (
          <div className="mt-4 flex items-center gap-2 rounded-[var(--cmd-radius)] border border-[color-mix(in_oklab,var(--cmd-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--cmd-warning)_10%,transparent)] px-4 py-2.5 text-sm text-[var(--cmd-warning)]">
            <AlertTriangle className="h-4 w-4" />
            Live data unavailable — {outage}. Showing last known state where possible.
          </div>
        ) : null}
      </div>

      {/* Team breakdown */}
      {snapshot ? (
        <div className="flex flex-wrap gap-2">
          {snapshot.teams
            .filter((t) => t.count > 0)
            .map((t) => (
              <span
                key={t.team}
                className="cmd-glass inline-flex items-center gap-2 rounded-[var(--cmd-radius-pill)] px-3 py-1.5 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: TEAM_DOT[t.team] ?? "#9AA4BF" }}
                />
                {t.team}
                <Badge tone="neutral">{t.count}</Badge>
              </span>
            ))}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          {/* Tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--cmd-radius)] px-3 py-1.5 text-sm transition",
                    tab === t.key
                      ? "cmd-gradient-fill"
                      : "text-[var(--cmd-fg-muted)] hover:bg-[var(--cmd-bg-muted)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {snapshot ? (
            <div>
              {tab === "players" ? <PlayersTable players={snapshot.players} /> : null}
              {tab === "map" ? <ErlcMap players={snapshot.players} /> : null}
              {tab === "vehicles" ? <VehiclesTable vehicles={snapshot.vehicles} /> : null}
              {tab === "joins" ? (
                <LogList
                  rows={snapshot.joinLogs.map((l) => ({
                    at: l.at,
                    left: l.player,
                    right: l.type === "join" ? "Joined" : "Left",
                    tone: l.type === "join" ? "success" : "neutral",
                  }))}
                />
              ) : null}
              {tab === "kills" ? (
                <LogList
                  rows={snapshot.killLogs.map((l) => ({
                    at: l.at,
                    left: `${l.killer} → ${l.victim}`,
                    right: l.weapon ?? "",
                    tone: "danger",
                  }))}
                />
              ) : null}
              {tab === "commands" ? (
                <LogList
                  rows={snapshot.commandLogs.map((l) => ({
                    at: l.at,
                    left: l.player,
                    right: l.command,
                    tone: "accent",
                    mono: true,
                  }))}
                />
              ) : null}
              {tab === "calls" ? <CallsList calls={snapshot.callLogs} /> : null}
            </div>
          ) : (
            <p className="p-6 text-sm text-[var(--cmd-fg-muted)]">
              No live data available right now.
            </p>
          )}
        </div>

        {/* Remote command console */}
        <div className="cmd-glass h-max rounded-[var(--cmd-radius-xl)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--cmd-accent)]" />
            <h3 className="font-semibold">Remote command</h3>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCommand();
            }}
          >
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder=":pm PlayerName Hello"
              className="font-[family-name:var(--cmd-font-mono)] text-sm"
              disabled={sending}
              aria-label="ER:LC command"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !command.trim()}
              aria-label="Send command"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[":refresh", ":wl", ":h Hi", ":pm Ordinex Hi"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCommand(preset)}
                className="rounded-[var(--cmd-radius-sm)] border border-[var(--cmd-border)] px-2 py-1 font-[family-name:var(--cmd-font-mono)] text-xs text-[var(--cmd-fg-muted)] hover:text-[var(--cmd-fg)]"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {history.length === 0 ? (
              <p className="text-xs text-[var(--cmd-fg-muted)]">
                Commands are dispatched to ER:LC and written to the audit log.
              </p>
            ) : (
              history.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-[var(--cmd-radius-sm)] border border-[var(--cmd-border)] p-2 text-xs"
                >
                  <p className="font-[family-name:var(--cmd-font-mono)] text-[var(--cmd-fg)]">
                    {entry.command}
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      entry.ok ? "text-[var(--cmd-success)]" : "text-[var(--cmd-danger)]",
                    )}
                  >
                    {entry.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold",
          mono && "font-[family-name:var(--cmd-font-mono)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlayersTable({ players }: { players: PlayerView[] }) {
  if (players.length === 0) {
    return <p className="p-4 text-sm text-[var(--cmd-fg-muted)]">No players online.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
          <tr className="border-b border-[var(--cmd-border)]">
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3">Callsign</th>
            <th className="py-2 pr-3">Team</th>
            <th className="py-2 pr-3">Wanted</th>
            <th className="py-2 pr-3">Vehicle</th>
            <th className="py-2 pr-3">Location</th>
            <th className="py-2 pr-3">Role</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-[var(--cmd-border)]/60">
              <td className="py-2 pr-3">
                <span className="font-medium">{p.name}</span>
              </td>
              <td className="py-2 pr-3 font-[family-name:var(--cmd-font-mono)] text-xs">
                {p.callsign ?? <span className="text-[var(--cmd-fg-muted)]">—</span>}
              </td>
              <td className="py-2 pr-3">
                <TeamTag team={p.team} />
              </td>
              <td className="py-2 pr-3">
                <WantedStars stars={p.wantedStars} />
              </td>
              <td className="py-2 pr-3 text-[var(--cmd-fg-muted)]">
                {p.vehicle ?? <span className="text-[var(--cmd-fg-muted)]">On foot</span>}
              </td>
              <td className="py-2 pr-3 text-[var(--cmd-fg-muted)]">
                {p.location.zone ?? <span className="text-[var(--cmd-fg-muted)]">Unknown</span>}
              </td>
              <td className="py-2 pr-3">
                {p.permission !== "Normal" ? (
                  <Badge tone="accent">{p.permission.replace("Server ", "")}</Badge>
                ) : (
                  <span className="text-[var(--cmd-fg-muted)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehiclesTable({
  vehicles,
}: {
  vehicles: { name: string; owner: string; texture: string | null }[];
}) {
  if (vehicles.length === 0) {
    return <p className="p-4 text-sm text-[var(--cmd-fg-muted)]">No spawned vehicles.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {vehicles.map((v, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
        >
          <Car className="h-4 w-4 text-[var(--cmd-accent)]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{v.name}</p>
            <p className="truncate text-xs text-[var(--cmd-fg-muted)]">
              {v.owner}
              {v.texture ? ` · ${v.texture}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

type LogRow = {
  at: string;
  left: string;
  right: string;
  tone: "success" | "neutral" | "danger" | "accent";
  mono?: boolean;
};

function LogList({ rows }: { rows: LogRow[] }) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-[var(--cmd-fg-muted)]">No entries.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--cmd-border)]">
      {rows.map((row, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Badge tone={row.tone}>
              {row.tone === "success"
                ? "IN"
                : row.tone === "danger"
                  ? "KILL"
                  : row.tone === "accent"
                    ? "CMD"
                    : "OUT"}
            </Badge>
            <span
              className={cn(
                "truncate",
                row.mono && "font-[family-name:var(--cmd-font-mono)] text-xs",
              )}
            >
              {row.left}
            </span>
            {row.right ? (
              <span className="truncate text-[var(--cmd-fg-muted)]">{row.right}</span>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-[var(--cmd-fg-muted)]">{timeAgo(row.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function CallsList({
  calls,
}: {
  calls: {
    id: string;
    caller: string;
    message: string;
    location: string | null;
    status: string;
    at: string;
  }[];
}) {
  if (calls.length === 0) {
    return <p className="p-4 text-sm text-[var(--cmd-fg-muted)]">No active emergency calls.</p>;
  }
  const tone = (s: string) => (s === "active" ? "danger" : s === "closed" ? "neutral" : "warning");
  return (
    <ul className="space-y-2">
      {calls.map((call) => (
        <li
          key={call.id}
          className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[var(--cmd-danger)]" />
              <span className="font-medium">{call.caller}</span>
              <Badge tone={tone(call.status)}>{call.status}</Badge>
            </div>
            <span className="text-xs text-[var(--cmd-fg-muted)]">{timeAgo(call.at)}</span>
          </div>
          <p className="mt-1.5 text-sm">{call.message}</p>
          {call.location ? (
            <p className="mt-0.5 text-xs text-[var(--cmd-fg-muted)]">📍 {call.location}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

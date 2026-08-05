"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Radio, RadioTower, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@commandry/ui";

type CommandCenterData = {
  summary: {
    unitsOnDuty: number;
    activeCalls: number;
    activeWarrants: number;
    activeBolos: number;
    civilians: number;
    vehicles: number;
  };
  live: {
    mode: string;
    connected: boolean;
    name: string;
    players: number;
    maxPlayers: number;
    region: string | null;
    message: string;
  } | null;
  calls: {
    id: string;
    callNumber: string | null;
    title: string;
    priority: number;
    status: string;
    units: string[];
  }[];
  availableUnits: number;
  busyUnits: number;
  priorityBuckets: { priority: number; count: number }[];
};

function priorityTone(priority: number): "danger" | "warning" | "neutral" {
  if (priority <= 1) return "danger";
  if (priority <= 3) return "warning";
  return "neutral";
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="cmd-glass rounded-[var(--cmd-radius)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub ? <p className="text-[11px] text-[var(--cmd-fg-muted)]">{sub}</p> : null}
    </div>
  );
}

export function CommandCenterView() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cad/command-center", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as CommandCenterData);
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(() => void refresh(), 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  if (!data) {
    return (
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-8 text-[var(--cmd-fg-muted)]">
        Loading command center…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Units on duty"
          value={data.summary.unitsOnDuty}
          sub={`${data.availableUnits} available · ${data.busyUnits} busy`}
        />
        <Stat label="Active calls" value={data.summary.activeCalls} />
        <Stat label="Active warrants" value={data.summary.activeWarrants} />
        <Stat label="Active BOLOs" value={data.summary.activeBolos} />
        <Stat label="Civilians" value={data.summary.civilians} />
        <Stat label="Vehicles" value={data.summary.vehicles} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Active calls */}
        <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--cmd-accent)]" />
            <h3 className="font-semibold">Active calls</h3>
            <Badge tone="neutral">{data.calls.length}</Badge>
          </div>
          {data.calls.length === 0 ? (
            <p className="text-sm text-[var(--cmd-fg-muted)]">No active calls.</p>
          ) : (
            <ul className="space-y-2">
              {data.calls.map((call) => (
                <li
                  key={call.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={priorityTone(call.priority)}>P{call.priority}</Badge>
                    {call.callNumber ? (
                      <span className="font-[family-name:var(--cmd-font-mono)] text-xs text-[var(--cmd-fg-muted)]">
                        {call.callNumber}
                      </span>
                    ) : null}
                    <span className="text-sm font-medium">{call.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--cmd-fg-muted)]">
                      {call.units.length > 0 ? call.units.join(", ") : "Unassigned"}
                    </span>
                    <Badge tone={call.status === "CLOSED" ? "neutral" : "accent"}>
                      {call.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live server + priority */}
        <div className="space-y-4">
          <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-[var(--cmd-accent)]" />
              <h3 className="font-semibold">ER:LC server</h3>
            </div>
            {data.live ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={data.live.mode === "live" ? "success" : "accent"}>
                    {data.live.mode === "live" ? "Live" : "Simulator"}
                  </Badge>
                  <Badge tone={data.live.connected ? "success" : "danger"}>
                    {data.live.connected ? "Connected" : "Offline"}
                  </Badge>
                </div>
                <p className="font-medium">{data.live.name}</p>
                <p className="text-[var(--cmd-fg-muted)]">
                  <Users className="mr-1 inline h-3.5 w-3.5" />
                  {data.live.players}/{data.live.maxPlayers} players
                  {data.live.region ? ` · ${data.live.region}` : ""}
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-[var(--cmd-warning)]">
                <AlertTriangle className="h-4 w-4" />
                ER:LC integration unavailable
              </p>
            )}
          </div>

          <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Radio className="h-4 w-4 text-[var(--cmd-accent)]" />
              <h3 className="font-semibold">Call priority</h3>
            </div>
            <div className="space-y-1.5">
              {data.priorityBuckets.map((bucket) => (
                <div key={bucket.priority} className="flex items-center gap-2 text-sm">
                  <Badge tone={priorityTone(bucket.priority)}>P{bucket.priority}</Badge>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--cmd-bg-muted)]">
                    <div
                      className="h-full cmd-gradient-fill"
                      style={{ width: `${Math.min(100, bucket.count * 20)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[var(--cmd-fg-muted)]">{bucket.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--cmd-danger)]" />
              <h3 className="font-semibold">Alerts</h3>
            </div>
            <p className="text-sm text-[var(--cmd-fg-muted)]">
              {data.summary.activeWarrants} active warrant(s) · {data.summary.activeBolos} active
              BOLO(s)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

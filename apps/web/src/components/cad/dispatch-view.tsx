"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, RadioTower, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { Badge, Button, Input, cn } from "@commandry/ui";
import type { CallDetail, CallSummary, Unit, UnitStatus, UnitType } from "./types";

const UNIT_STATUSES: UnitStatus[] = [
  "AVAILABLE",
  "BUSY",
  "EN_ROUTE",
  "ON_SCENE",
  "PANIC",
  "OUT_OF_SERVICE",
];
const UNIT_TYPES: UnitType[] = ["POLICE", "SHERIFF", "STATE", "FIRE", "EMS", "DISPATCH"];

const STATUS_COLOR: Record<UnitStatus, string> = {
  AVAILABLE: "#22C55E",
  BUSY: "#F5A623",
  EN_ROUTE: "#3B6CFF",
  ON_SCENE: "#8B5CF6",
  PANIC: "#EF4444",
  OUT_OF_SERVICE: "#6C7488",
};

function priorityTone(priority: number): "danger" | "warning" | "neutral" {
  if (priority <= 1) return "danger";
  if (priority <= 3) return "warning";
  return "neutral";
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function DispatchView({ onChange }: { onChange: () => void }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selected, setSelected] = useState<CallDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Go-on-duty form
  const [callsign, setCallsign] = useState("");
  const [officer, setOfficer] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("POLICE");

  // New-call form
  const [callTitle, setCallTitle] = useState("");
  const [callMessage, setCallMessage] = useState("");
  const [callLocation, setCallLocation] = useState("");
  const [callPriority, setCallPriority] = useState(3);

  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    const [u, c] = await Promise.all([
      fetch("/api/cad/units", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/cad/calls", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setUnits(u.units ?? []);
    setCalls(c.calls ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(() => void refresh(), 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const openCall = useCallback(async (id: string) => {
    const res = await fetch(`/api/cad/calls/${id}`, { cache: "no-store" });
    const json = await res.json();
    setSelected(json.call ?? null);
  }, []);

  async function goOnDuty() {
    if (!callsign.trim() || !officer.trim()) return;
    await fetch("/api/cad/units", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callsign, name: officer, type: unitType }),
    });
    setCallsign("");
    setOfficer("");
    await refresh();
    onChange();
  }

  async function changeUnitStatus(id: string, status: UnitStatus) {
    await fetch(`/api/cad/units/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function offDuty(id: string) {
    await fetch(`/api/cad/units/${id}`, { method: "DELETE" });
    await refresh();
    onChange();
  }

  async function createCall() {
    if (!callTitle.trim() || !callMessage.trim()) return;
    await fetch("/api/cad/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: callTitle,
        message: callMessage,
        location: callLocation || undefined,
        priority: callPriority,
      }),
    });
    setCallTitle("");
    setCallMessage("");
    setCallLocation("");
    await refresh();
    onChange();
  }

  async function callAction(body: Record<string, unknown>) {
    if (!selected) return;
    const res = await fetch(`/api/cad/calls/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.call) setSelected(json.call);
    await refresh();
    onChange();
  }

  async function syncErlc() {
    setSyncing(true);
    try {
      await fetch("/api/erlc/sync", { method: "POST" });
      await refresh();
      onChange();
    } finally {
      setSyncing(false);
    }
  }

  const availableUnits = units.filter((u) => !selected?.assignedUnits.some((a) => a.id === u.id));

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_340px]">
      {/* Units column */}
      <div className="cmd-glass h-max rounded-[var(--cmd-radius-xl)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-[var(--cmd-accent)]" />
          <h3 className="font-semibold">Units on duty</h3>
          <Badge tone="neutral">{units.length}</Badge>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Callsign"
              className="h-9 px-3 text-sm"
            />
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType)}
              className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[rgba(8,12,24,0.72)] px-3 text-sm"
            >
              {UNIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Input
              value={officer}
              onChange={(e) => setOfficer(e.target.value)}
              placeholder="Officer name"
              className="h-9 px-3 text-sm"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => void goOnDuty()}
              aria-label="Go on duty"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {units.length === 0 ? (
            <li className="text-xs text-[var(--cmd-fg-muted)]">No units on duty. Add one above.</li>
          ) : (
            units.map((unit) => (
              <li
                key={unit.id}
                className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {unit.callsign} · {unit.name}
                    </p>
                    <p className="text-[11px] text-[var(--cmd-fg-muted)]">
                      {unit.type}
                      {unit.assignedCall ? ` · ${unit.assignedCall.title}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => void offDuty(unit.id)}
                    className="text-[var(--cmd-fg-muted)] hover:text-[var(--cmd-danger)]"
                    aria-label="Go off duty"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[unit.status] }}
                  />
                  <select
                    value={unit.status}
                    onChange={(e) => void changeUnitStatus(unit.id, e.target.value as UnitStatus)}
                    className="h-8 flex-1 rounded-[var(--cmd-radius-sm)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-xs"
                  >
                    {UNIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Calls column */}
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Active calls</h3>
            <Badge tone="neutral">{calls.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => void syncErlc()} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync ER:LC
          </Button>
        </div>

        <div className="mb-3 space-y-2 rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] p-3">
          <div className="flex gap-2">
            <Input
              value={callTitle}
              onChange={(e) => setCallTitle(e.target.value)}
              placeholder="Call title (e.g. Robbery in progress)"
              className="h-9 px-3 text-sm"
            />
            <select
              value={callPriority}
              onChange={(e) => setCallPriority(Number(e.target.value))}
              className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[rgba(8,12,24,0.72)] px-3 text-sm"
              aria-label="Priority"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  P{p}
                </option>
              ))}
            </select>
          </div>
          <Input
            value={callMessage}
            onChange={(e) => setCallMessage(e.target.value)}
            placeholder="Details"
            className="h-9 px-3 text-sm"
          />
          <div className="flex gap-2">
            <Input
              value={callLocation}
              onChange={(e) => setCallLocation(e.target.value)}
              placeholder="Location"
              className="h-9 px-3 text-sm"
            />
            <Button size="sm" onClick={() => void createCall()}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>

        <ul className="space-y-2">
          {calls.length === 0 ? (
            <li className="p-4 text-sm text-[var(--cmd-fg-muted)]">
              No active calls. Create one above or sync from ER:LC.
            </li>
          ) : (
            calls.map((call) => (
              <li key={call.id}>
                <button
                  onClick={() => void openCall(call.id)}
                  className={cn(
                    "w-full rounded-[var(--cmd-radius)] border p-3 text-left transition",
                    selected?.id === call.id
                      ? "border-[var(--cmd-accent)] bg-[var(--cmd-bg-muted)]"
                      : "border-[var(--cmd-border)] hover:bg-[var(--cmd-bg-muted)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={priorityTone(call.priority)}>P{call.priority}</Badge>
                      {call.callNumber ? (
                        <span className="font-[family-name:var(--cmd-font-mono)] text-[11px] text-[var(--cmd-fg-muted)]">
                          {call.callNumber}
                        </span>
                      ) : null}
                      <span className="text-sm font-semibold">{call.title}</span>
                    </div>
                    <span className="text-[11px] text-[var(--cmd-fg-muted)]">
                      {timeAgo(call.openedAt)} ago
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--cmd-fg-muted)]">
                    {call.message}
                    {call.location ? ` · ${call.location}` : ""}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone={call.status === "CLOSED" ? "neutral" : "accent"}>
                      {call.status}
                    </Badge>
                    {call.units.length > 0 ? (
                      <span className="text-[11px] text-[var(--cmd-fg-muted)]">
                        {call.units.join(", ")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--cmd-fg-muted)]">Unassigned</span>
                    )}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Detail column */}
      <div className="cmd-glass h-max rounded-[var(--cmd-radius-xl)] p-4">
        {!selected ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Select a call to dispatch units and add notes.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{selected.title}</h3>
              <Badge tone={priorityTone(selected.priority)}>P{selected.priority}</Badge>
            </div>
            <p className="text-sm text-[var(--cmd-fg-muted)]">{selected.message}</p>
            {selected.location ? (
              <p className="text-xs text-[var(--cmd-fg-muted)]">📍 {selected.location}</p>
            ) : null}

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                Assigned units
              </p>
              {selected.assignedUnits.length === 0 ? (
                <p className="text-xs text-[var(--cmd-fg-muted)]">None assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.assignedUnits.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => void callAction({ action: "unassign", unitId: u.id })}
                      className="inline-flex items-center gap-1 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] px-2 py-1 text-xs hover:border-[var(--cmd-danger)]"
                      title="Unassign"
                    >
                      {u.callsign} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              {availableUnits.length > 0 && selected.status !== "CLOSED" ? (
                <select
                  className="mt-2 h-8 w-full rounded-[var(--cmd-radius-sm)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-xs"
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      void callAction({ action: "assign", unitId: e.target.value });
                  }}
                >
                  <option value="">+ Assign unit…</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.callsign} · {u.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                Timeline
              </p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {selected.logs.length === 0 ? (
                  <p className="text-xs text-[var(--cmd-fg-muted)]">No updates yet.</p>
                ) : (
                  selected.logs.map((entry) => (
                    <div key={entry.id} className="text-xs">
                      <span className="text-[var(--cmd-fg-muted)]">
                        {timeAgo(entry.createdAt)} ago ·{" "}
                      </span>
                      {entry.note}
                    </div>
                  ))
                )}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) {
                    void callAction({ action: "log", note });
                    setNote("");
                  }
                }}
              >
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note…"
                  className="h-9 px-3 text-sm"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  type="submit"
                  aria-label="Add note"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>

            {selected.status !== "CLOSED" ? (
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={() => void callAction({ action: "close" })}
              >
                Close call
              </Button>
            ) : (
              <Badge tone="neutral">Call closed</Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

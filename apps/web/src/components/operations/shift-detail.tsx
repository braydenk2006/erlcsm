"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Skeleton } from "@commandry/ui";

type Detail = {
  shift: {
    id: string;
    title: string;
    shiftType: string;
    status: string;
    scheduledStart: string;
    scheduledEnd: string;
    claimPolicy: string;
    prcSyncPolicy: string;
    hostMembershipId: string | null;
    discordState: string;
    prcSyncState: string;
    erlcServer: string | null;
  };
  claims: {
    id: string;
    membershipId: string;
    userId: string;
    status: string;
    reason: string | null;
  }[];
  attendance: { membershipId: string; name: string; status: string; minutes: number }[];
  timeline: { type: string; occurredAt: string; metadata: Record<string, unknown> }[];
  prcMatches: {
    robloxUserId: string;
    robloxUsername: string;
    membershipId: string | null;
    team: string | null;
    presenceMinutes: number;
    applied: boolean;
  }[];
  loggedMinutes: {
    membershipId: string;
    name: string;
    firstSeen: string | null;
    lastSeen: string | null;
    intervals: {
      start: string;
      end: string;
      seconds: number;
      team: string | null;
      eligible: boolean;
      confidence: string;
      reconciliation: string;
    }[];
    automaticMinutes: number;
    adjustmentMinutes: number;
    finalMinutes: number;
    confidence: string;
    reconciliation: string;
  }[];
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

const badgeTone = (status: string) =>
  status === "COMPLETED"
    ? "success"
    : status === "CANCELLED" || status === "MISSED"
      ? "neutral"
      : "accent";

export function ShiftDetail({
  shiftId,
  members,
  canManage,
  onChanged,
}: {
  shiftId: string;
  members: { membershipId: string; name: string }[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addMember, setAddMember] = useState("");

  const load = useCallback(async () => {
    try {
      setDetail(await api(`/api/schedule/${shiftId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [shiftId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/schedule/${shiftId}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <Skeleton className="h-40 w-full" />;
  const s = detail.shift;

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-[var(--cmd-danger)]">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={badgeTone(s.status)}>{s.status.replace(/_/g, " ").toLowerCase()}</Badge>
          <span className="text-sm text-[var(--cmd-fg-muted)]">
            {new Date(s.scheduledStart).toLocaleString()} →{" "}
            {new Date(s.scheduledEnd).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--cmd-fg-muted)]">
          <span>Discord: {s.discordState.toLowerCase()}</span>
          <span>· PRC: {s.prcSyncState.toLowerCase()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canManage && s.status === "DRAFT" ? (
          <Button size="sm" onClick={() => act({ action: "open_claiming" })} disabled={busy}>
            Open claiming
          </Button>
        ) : null}
        {s.status === "OPEN_CLAIMING" ? (
          <Button size="sm" onClick={() => act({ action: "claim" })} disabled={busy}>
            Claim
          </Button>
        ) : null}
        {canManage && (s.status === "CLAIMED" || s.status === "SCHEDULED") ? (
          <Button size="sm" onClick={() => act({ action: "publish" })} disabled={busy}>
            Publish to Discord
          </Button>
        ) : null}
        {s.status === "PUBLISHED" || s.status === "CLAIMED" ? (
          <Button
            size="sm"
            onClick={() => act({ action: "start", override: true })}
            disabled={busy}
          >
            Start shift
          </Button>
        ) : null}
        {s.status === "ACTIVE" ? (
          <>
            {s.erlcServer ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => act({ action: "prc_sync" })}
                disabled={busy}
              >
                Sync PRC
              </Button>
            ) : null}
            <Button size="sm" onClick={() => act({ action: "complete" })} disabled={busy}>
              Complete
            </Button>
          </>
        ) : null}
        {canManage && !["COMPLETED", "CANCELLED", "MISSED", "ARCHIVED"].includes(s.status) ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => act({ action: "cancel", reason: "Cancelled by manager" })}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {/* Pending claims (approval workflow) */}
      {detail.claims.filter((c) => c.status === "REQUESTED").length > 0 && canManage ? (
        <div className="cmd-glass rounded-[var(--cmd-radius)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
            Claim requests
          </p>
          {detail.claims
            .filter((c) => c.status === "REQUESTED")
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                <span>
                  {members.find((m) => m.membershipId === c.membershipId)?.name ?? "Member"}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => act({ action: "decide_claim", claimId: c.id, approve: true })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act({ action: "decide_claim", claimId: c.id, approve: false })}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {/* Attendance */}
      <div className="cmd-glass rounded-[var(--cmd-radius)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
          Attendance
        </p>
        {detail.attendance.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No attendance recorded.</p>
        ) : (
          <ul className="space-y-1">
            {detail.attendance.map((a) => (
              <li
                key={a.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {a.name} ·{" "}
                  <span className="text-[var(--cmd-fg-muted)]">{a.status.toLowerCase()}</span>
                </span>
                {canManage && (s.status === "ACTIVE" || s.status === "PUBLISHED") ? (
                  <div className="flex gap-1">
                    {["PRESENT", "LATE", "ABSENT"].map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          act({
                            action: "attendance",
                            membershipId: a.membershipId,
                            status: st,
                            minutes: 60,
                          })
                        }
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
        {canManage && (s.status === "ACTIVE" || s.status === "PUBLISHED") ? (
          <div className="mt-2 flex gap-2">
            <select
              className="h-9 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
              value={addMember}
              onChange={(e) => setAddMember(e.target.value)}
            >
              <option value="">Add attendee…</option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!addMember}
              onClick={() =>
                addMember &&
                act({
                  action: "attendance",
                  membershipId: addMember,
                  status: "PRESENT",
                  minutes: 60,
                })
              }
            >
              Mark present
            </Button>
          </div>
        ) : null}
      </div>

      {/* PRC matches */}
      {detail.prcMatches.length > 0 ? (
        <div className="cmd-glass rounded-[var(--cmd-radius)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
            PRC presence ({s.prcSyncPolicy.toLowerCase().replace(/_/g, " ")})
          </p>
          <ul className="space-y-1 text-sm">
            {detail.prcMatches.map((m) => (
              <li key={m.robloxUserId} className="flex items-center justify-between">
                <span>
                  {m.robloxUsername} {m.team ? `· ${m.team}` : ""}
                </span>
                <span className="text-xs text-[var(--cmd-fg-muted)]">
                  {m.applied ? "applied" : "suggested"} · {m.presenceMinutes}m
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Verified server minutes (derived from private-server presence, not scheduled duration) */}
      {detail.loggedMinutes.length > 0 ? (
        <div className="cmd-glass rounded-[var(--cmd-radius)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
            Verified server minutes
          </p>
          <ul className="space-y-3">
            {detail.loggedMinutes.map((row) => (
              <li
                key={row.membershipId}
                className="border-b border-[var(--cmd-border)]/40 pb-3 text-sm last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.name}</span>
                  <span>
                    <span className="text-[var(--cmd-fg-muted)]">Final logged: </span>
                    <span className="font-semibold">{row.finalMinutes}m</span>
                    {row.adjustmentMinutes !== 0 ? (
                      <span className="text-xs text-[var(--cmd-accent)]">
                        {" "}
                        (auto {row.automaticMinutes}m {row.adjustmentMinutes > 0 ? "+" : ""}
                        {row.adjustmentMinutes})
                      </span>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">
                  {row.firstSeen
                    ? `First confirmed join ${new Date(row.firstSeen).toLocaleTimeString()}`
                    : "No confirmed join"}
                  {row.lastSeen
                    ? ` · Last confirmed leave ${new Date(row.lastSeen).toLocaleTimeString()}`
                    : ""}
                  {row.confidence !== "CONFIRMED"
                    ? ` · ${row.confidence.replace(/_/g, " ").toLowerCase()}`
                    : ""}
                </p>
                {row.intervals.length > 0 ? (
                  <ul className="mt-1 text-xs text-[var(--cmd-fg-muted)]">
                    {row.intervals.map((interval, idx) => (
                      <li key={idx}>
                        {new Date(interval.start).toLocaleTimeString()}–
                        {new Date(interval.end).toLocaleTimeString()} ·{" "}
                        {Math.round(interval.seconds / 60)}m{" "}
                        {interval.team ? `· ${interval.team}` : ""}{" "}
                        {interval.eligible ? "" : "· ineligible"}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {canManage && (s.status === "ACTIVE" || s.status === "COMPLETED") ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Final minutes"
                      defaultValue={row.finalMinutes}
                      className="h-8 w-28 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number((e.target as HTMLInputElement).value);
                          void act({
                            action: "adjust_minutes",
                            membershipId: row.membershipId,
                            finalMinutes: value,
                            reason: "Host review adjustment",
                          });
                        }
                      }}
                    />
                    <span className="text-xs text-[var(--cmd-fg-muted)]">
                      press Enter to adjust
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Timeline */}
      <div className="cmd-glass rounded-[var(--cmd-radius)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
          Shift timeline
        </p>
        <ul className="space-y-1 text-sm">
          {detail.timeline.map((e, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{e.type.replace(/_/g, " ").toLowerCase()}</span>
              <span className="text-xs text-[var(--cmd-fg-muted)]">
                {new Date(e.occurredAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

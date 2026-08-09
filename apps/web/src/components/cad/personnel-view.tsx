"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge, Button, EmptyState } from "@commandry/ui";

type PlayerHistoryRow = {
  id: string;
  robloxUsername: string;
  robloxUserId: string;
  callsign: string | null;
  team: string | null;
  sessionCount: number;
  lastSeenAt: string;
  linkedToRoblox: boolean;
};

export function PersonnelView({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<PlayerHistoryRow[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/erlc/history", { cache: "no-store" });
    const json = await res.json();
    setRows(json.history ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      await fetch("/api/erlc/sync", { method: "POST" });
      await load();
      onChange();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Player history</h3>
          <p className="text-xs text-[var(--cmd-fg-muted)]">
            ER:LC presence correlated with known Roblox identities.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void sync()} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sync ER:LC
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No player history yet"
          description="Sync from the live server to roll up player presence and correlate it with Roblox identities."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
              <tr className="border-b border-[var(--cmd-border)]">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3">Roblox ID</th>
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">Callsign</th>
                <th className="py-2 pr-3">Sessions</th>
                <th className="py-2 pr-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--cmd-border)]/60">
                  <td className="py-2 pr-3 font-medium">{row.robloxUsername}</td>
                  <td className="py-2 pr-3 font-[family-name:var(--cmd-font-mono)] text-xs text-[var(--cmd-fg-muted)]">
                    {row.robloxUserId}
                  </td>
                  <td className="py-2 pr-3">{row.team ?? "—"}</td>
                  <td className="py-2 pr-3 font-[family-name:var(--cmd-font-mono)] text-xs">
                    {row.callsign ?? "—"}
                  </td>
                  <td className="py-2 pr-3">{row.sessionCount}</td>
                  <td className="py-2 pr-3">
                    {row.linkedToRoblox ? (
                      <Badge tone="success">Linked</Badge>
                    ) : (
                      <Badge tone="neutral">—</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

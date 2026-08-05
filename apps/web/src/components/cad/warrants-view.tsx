"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Badge, Button, EmptyState } from "@commandry/ui";
import type { Warrant } from "./types";

export function WarrantsView({ onChange }: { onChange: () => void }) {
  const [warrants, setWarrants] = useState<Warrant[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/cad/warrants?status=ACTIVE", { cache: "no-store" });
    const json = await res.json();
    setWarrants(json.warrants ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear(id: string) {
    await fetch(`/api/cad/warrants/${id}`, { method: "PATCH" });
    await load();
    onChange();
  }

  return (
    <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-[var(--cmd-danger)]" />
        <h3 className="font-semibold">Active warrants</h3>
        <Badge tone="neutral">{warrants.length}</Badge>
      </div>
      {warrants.length === 0 ? (
        <EmptyState
          title="No active warrants"
          description="Warrants issued from a civilian's record appear here for the whole department."
        />
      ) : (
        <ul className="space-y-2">
          {warrants.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {w.civilian?.name ?? "Unknown"} — {w.reason}
                </p>
                {w.charges.length > 0 ? (
                  <p className="text-xs text-[var(--cmd-fg-muted)]">{w.charges.join(", ")}</p>
                ) : null}
                {w.issuedBy ? (
                  <p className="text-[11px] text-[var(--cmd-fg-muted)]">Issued by {w.issuedBy}</p>
                ) : null}
              </div>
              <Button size="sm" variant="outline" onClick={() => void clear(w.id)}>
                Clear
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

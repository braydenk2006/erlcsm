"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@commandry/ui";

export function CadSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/erlc/sync", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        cad?: { synced: number };
        history?: { tracked: number; correlated: number };
        error?: string;
      };
      if (json.ok) {
        setResult(
          `Synced ${json.cad?.synced ?? 0} calls · tracked ${json.history?.tracked ?? 0} players (${json.history?.correlated ?? 0} linked to Roblox)`,
        );
        router.refresh();
      } else {
        setResult(json.error ?? "Sync failed");
      }
    } catch {
      setResult("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => void sync()} disabled={busy} size="sm">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync from ER:LC
      </Button>
      {result ? <span className="text-sm text-[var(--cmd-fg-muted)]">{result}</span> : null}
    </div>
  );
}

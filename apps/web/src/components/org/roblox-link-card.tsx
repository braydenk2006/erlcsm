"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Linked = {
  robloxUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  verifiedAt: string;
};
type Challenge = {
  robloxUserId: string;
  username: string;
  displayName: string | null;
  code: string;
  expiresAt: string;
  instructions: string;
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

export function RobloxLinkCard() {
  const [linked, setLinked] = useState<Linked | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api("/api/roblox");
      setLinked(status.linked);
      setChallenge(status.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api("/api/roblox", {
        method: "POST",
        body: JSON.stringify({ action: "start", username }),
      });
      setChallenge(res.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start verification");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api("/api/roblox", {
        method: "POST",
        body: JSON.stringify({ action: "confirm" }),
      });
      setLinked(res.linked);
      setChallenge(null);
      setUsername("");
      setMessage("Roblox account linked.");
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await api("/api/roblox", { method: "DELETE" }).catch(() => undefined);
    setChallenge(null);
    setError(null);
    void load();
  };

  const unlink = async () => {
    if (!window.confirm("Unlink your Roblox account?")) return;
    setBusy(true);
    try {
      await api("/api/roblox", { method: "DELETE" });
      setLinked(null);
      setMessage("Roblox account unlinked.");
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Roblox account</h2>
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Verify ownership by adding a one-time code to your Roblox profile. We never ask for your
            password or cookies.
          </p>
        </div>
        {linked ? <Badge tone="success">Linked</Badge> : <Badge tone="neutral">Not linked</Badge>}
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--cmd-danger)]">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--cmd-success)]">{message}</p> : null}

      {linked ? (
        <div className="mt-4 flex items-center gap-3">
          {linked.avatarUrl ? (
            <img
              src={linked.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)]"
            />
          ) : null}
          <div className="flex-1">
            <p className="font-medium">{linked.displayName ?? linked.username}</p>
            <p className="text-xs text-[var(--cmd-fg-muted)]">
              @{linked.username} · Roblox ID {linked.robloxUserId}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={unlink} disabled={busy}>
            Unlink
          </Button>
        </div>
      ) : challenge ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            Linking <strong>{challenge.displayName ?? challenge.username}</strong> (@
            {challenge.username}).
          </p>
          <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-3">
            <p className="text-xs text-[var(--cmd-fg-muted)]">
              Add this code to your Roblox profile &ldquo;About&rdquo; section:
            </p>
            <p className="mt-1 select-all font-mono text-lg tracking-wide">{challenge.code}</p>
          </div>
          <p className="text-xs text-[var(--cmd-fg-muted)]">
            Then return here and click Verify. The code expires in 15 minutes.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirm} disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={start} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="roblox-username">Roblox username</Label>
            <Input
              id="roblox-username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Builderman"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Starting…" : "Start verification"}
          </Button>
        </form>
      )}
    </section>
  );
}

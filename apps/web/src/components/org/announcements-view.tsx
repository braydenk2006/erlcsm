"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: string;
  pinned: boolean;
  authorName: string;
  publishedAt: string | null;
  expiresAt: string | null;
  read: boolean;
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

export function AnnouncementsView({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api(`/api/announcements`);
      setItems(res.announcements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/announcements`, {
        method: "POST",
        body: JSON.stringify({ title, body, pinned }),
      });
      setTitle("");
      setBody("");
      setPinned(false);
      flash("Draft saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create announcement");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, action: string) => {
    await api(`/api/announcements/${id}`, { method: "PATCH", body: JSON.stringify({ action }) })
      .then(() => {
        flash("Updated.");
        void load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  };

  if (loading && items.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Community</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Announcements</h1>
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
        <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <h2 className="font-medium">New announcement</h2>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ann-body">Message</Label>
              <textarea
                id="ann-body"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--cmd-fg-muted)]">
          No announcements yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {a.pinned ? <Badge tone="accent">Pinned</Badge> : null}
                    <Badge
                      tone={
                        a.status === "PUBLISHED"
                          ? "success"
                          : a.status === "DRAFT"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {a.status.toLowerCase()}
                    </Badge>
                    {!a.read && a.status === "PUBLISHED" ? <Badge tone="accent">New</Badge> : null}
                  </div>
                  <h3 className="mt-2 font-medium">{a.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--cmd-fg-muted)]">
                    {a.body}
                  </p>
                  <p className="mt-2 text-xs text-[var(--cmd-fg-muted)]">By {a.authorName}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "PUBLISHED" && !a.read ? (
                  <Button size="sm" variant="outline" onClick={() => act(a.id, "read")}>
                    Mark read
                  </Button>
                ) : null}
                {canManage && a.status !== "PUBLISHED" ? (
                  <Button size="sm" onClick={() => act(a.id, "publish")}>
                    Publish
                  </Button>
                ) : null}
                {canManage && a.status === "PUBLISHED" ? (
                  <Button size="sm" variant="ghost" onClick={() => act(a.id, "archive")}>
                    Archive
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

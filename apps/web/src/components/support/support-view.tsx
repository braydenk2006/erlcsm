"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Ticket = {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
};
type Message = { id: string; authorType: string; body: string; createdAt: string };

const CATEGORIES = [
  "general",
  "account",
  "billing",
  "discord",
  "roblox",
  "erlc",
  "cad_rms",
  "website",
  "automation",
  "ai",
  "bug",
  "feature",
  "security",
  "enterprise",
];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json;
}

export function SupportView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [detail, setDetail] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    category: "general",
    priority: "NORMAL",
    body: "",
  });
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    try {
      setTickets((await api("/api/support")).tickets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    try {
      setDetail(await api(`/api/support/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = await api("/api/support", { method: "POST", body: JSON.stringify(form) });
      setCreating(false);
      setForm({ subject: "", category: "general", priority: "NORMAL", body: "" });
      await load();
      await open(json.ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const sendReply = async () => {
    if (!detail || reply.trim().length < 1) return;
    await api(`/api/support/${detail.ticket.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "reply", body: reply }),
    }).catch((e) => setError(e.message));
    setReply("");
    await open(detail.ticket.id);
    await load();
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
            Help &amp; Support
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">Support</h1>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreating((c) => !c);
            setDetail(null);
          }}
        >
          {creating ? "Cancel" : "New ticket"}
        </Button>
      </header>
      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {creating ? (
        <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <Label htmlFor="s-subj">Subject</Label>
              <Input
                id="s-subj"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary"
              />
            </div>
            <div>
              <Label htmlFor="s-cat">Category</Label>
              <select
                id="s-cat"
                className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="s-pri">Priority</Label>
              <select
                id="s-pri"
                className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="s-body">How can we help?</Label>
            <textarea
              id="s-body"
              required
              className="min-h-28 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-2 text-sm"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <Button type="submit">Submit ticket</Button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ul className="space-y-2">
          {tickets.length === 0 ? (
            <li className="text-sm text-[var(--cmd-fg-muted)]">No tickets yet.</li>
          ) : null}
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => open(t.id)}
                className={`w-full rounded-[var(--cmd-radius-xl)] p-3 text-left ${detail?.ticket.id === t.id ? "cmd-glass-strong" : "cmd-glass hover:bg-[var(--cmd-bg-muted)]"}`}
              >
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{t.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  <span className="text-xs text-[var(--cmd-fg-muted)]">{t.number}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{t.subject}</p>
              </button>
            </li>
          ))}
        </ul>
        <div>
          {detail ? (
            <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
              <h2 className="text-lg font-semibold">{detail.ticket.subject}</h2>
              <p className="text-xs text-[var(--cmd-fg-muted)]">
                {detail.ticket.number} · {detail.ticket.category} ·{" "}
                {detail.ticket.status.replace(/_/g, " ").toLowerCase()}
              </p>
              <ul className="mt-3 space-y-2">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-[var(--cmd-radius)] p-2.5 text-sm ${m.authorType === "staff" ? "bg-[var(--cmd-accent)]/10" : "bg-[var(--cmd-bg-muted)]"}`}
                  >
                    <p className="text-xs text-[var(--cmd-fg-muted)]">
                      {m.authorType === "staff" ? "Ordinex Support" : "You"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
              {detail.ticket.status !== "CLOSED" ? (
                <div className="mt-3">
                  <textarea
                    className="min-h-20 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-2 text-sm"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply…"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={sendReply}
                    disabled={reply.trim().length < 1}
                  >
                    Send reply
                  </Button>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="cmd-glass flex items-center justify-center rounded-[var(--cmd-radius-xl)] p-8 text-sm text-[var(--cmd-fg-muted)]">
              Select a ticket or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Overview = {
  role: string;
  openTickets: number;
  urgentTickets: number;
  assignedToMe: number;
  activeSupportSessions: number;
  failedWebhookDeliveries24h: number;
  recentOrganizations: { id: string; name: string; plan: string; createdAt: string }[];
  recentStaffActivity: { at: string; action: string }[];
};
type Hit = { kind: string; id: string; label: string; sublabel: string };
type OrgProfile = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: string;
  subscriptionStatus: string;
  memberCount: number;
  departmentCount: number;
  integrations: { provider: string; status: string }[];
  webhookEndpoints: number;
  apiKeys: number;
  entitledFeatures: number;
  openTickets: number;
};
type Session = {
  id: string;
  organizationName: string;
  staffName: string;
  reason: string;
  scope: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  active: boolean;
};
type Ticket = {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  organizationName: string;
  requesterEmail: string;
};
type Message = {
  id: string;
  authorType: string;
  internal: boolean;
  body: string;
  createdAt: string;
};

const SCOPES = [
  "VIEW_CONFIGURATION",
  "VIEW_AS_CUSTOMER",
  "DIAGNOSE_INTEGRATIONS",
  "DIAGNOSE_ENTITLEMENTS",
  "DIAGNOSE_BILLING",
  "DIAGNOSE_FEATURE",
];

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

export function StaffPanel({ role: _role }: { role: string }) {
  const [tab, setTab] = useState<"overview" | "customers" | "tickets">("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [org, setOrg] = useState<{ profile: OrgProfile; sessions: Session[] } | null>(null);
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState(SCOPES[0]!);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticket, setTicket] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");

  const notify = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3000);
  };

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api("/api/staff"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    if (tab === "tickets")
      void api("/api/staff/tickets")
        .then((d) => setTickets(d.tickets))
        .catch((e) => setError(e.message));
  }, [tab]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setResults((await api(`/api/staff/search?q=${encodeURIComponent(query)}`)).results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const openOrg = async (id: string) => {
    try {
      setOrg(await api(`/api/staff/org/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const startSession = async () => {
    if (!org) return;
    try {
      await api(`/api/staff/org/${org.profile.id}`, {
        method: "POST",
        body: JSON.stringify({ reason, scope, mode: "read_only" }),
      });
      setReason("");
      await openOrg(org.profile.id);
      await loadOverview();
      notify("Support session started (read-only)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const revokeSession = async (id: string) => {
    await api(`/api/staff/sessions/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    if (org) await openOrg(org.profile.id);
  };
  const openTicket = async (id: string) => {
    try {
      setTicket(await api(`/api/staff/tickets/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const ticketAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!ticket) return;
    try {
      await api(`/api/staff/tickets/${ticket.ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra }),
      });
      setReply("");
      await openTicket(ticket.ticket.id);
      await api("/api/staff/tickets").then((d) => setTickets(d.tickets));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">Staff Panel</h1>
      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-success)]/40 bg-[var(--cmd-success)]/10 px-4 py-3 text-sm">
          {flash}
        </div>
      ) : null}

      <div className="flex gap-2">
        {(["overview", "customers", "tickets"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "primary" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "overview" ? (
        overview ? (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "Open tickets", value: overview.openTickets },
                { label: "Urgent", value: overview.urgentTickets },
                { label: "Assigned to me", value: overview.assignedToMe },
                { label: "Active sessions", value: overview.activeSupportSessions },
                { label: "Webhook fails 24h", value: overview.failedWebhookDeliveries24h },
              ].map((c) => (
                <div key={c.label} className="cmd-glass rounded-[var(--cmd-radius)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    {c.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{c.value}</p>
                </div>
              ))}
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
                <h2 className="mb-2 text-sm font-semibold">Recent organizations</h2>
                <ul className="space-y-1 text-sm">
                  {overview.recentOrganizations.map((o) => (
                    <li key={o.id} className="flex items-center justify-between">
                      <span>{o.name}</span>
                      <Badge tone="neutral">{o.plan}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
                <h2 className="mb-2 text-sm font-semibold">Recent staff activity</h2>
                <ul className="space-y-1 text-xs text-[var(--cmd-fg-muted)]">
                  {overview.recentStaffActivity.length === 0 ? (
                    <li>No recent staff actions.</li>
                  ) : null}
                  {overview.recentStaffActivity.map((a, i) => (
                    <li key={i}>
                      {a.action} · {new Date(a.at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        ) : (
          <Skeleton className="h-64 w-full" />
        )
      ) : null}

      {tab === "customers" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <form onSubmit={search} className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search org, email, name, ID…"
              />
              <Button size="sm" type="submit">
                Search
              </Button>
            </form>
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  {r.kind === "organization" ? (
                    <button
                      onClick={() => openOrg(r.id)}
                      className="cmd-glass flex w-full items-center justify-between rounded-[var(--cmd-radius)] p-3 text-left text-sm hover:bg-[var(--cmd-bg-muted)]"
                    >
                      <span>
                        <Badge tone="accent">org</Badge>{" "}
                        <span className="ml-2 font-medium">{r.label}</span>
                      </span>
                      <span className="text-xs text-[var(--cmd-fg-muted)]">{r.sublabel}</span>
                    </button>
                  ) : (
                    <div className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius)] p-3 text-sm">
                      <span>
                        <Badge tone="neutral">user</Badge>{" "}
                        <span className="ml-2 font-medium">{r.label}</span>
                      </span>
                      <span className="text-xs text-[var(--cmd-fg-muted)]">{r.sublabel}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            {org ? (
              <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
                <h2 className="font-[family-name:var(--cmd-font-display)] text-2xl">
                  {org.profile.name}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                  <Stat label="Plan" value={org.profile.plan} />
                  <Stat label="Subscription" value={org.profile.subscriptionStatus} />
                  <Stat label="Members" value={org.profile.memberCount} />
                  <Stat label="Departments" value={org.profile.departmentCount} />
                  <Stat label="Entitled features" value={org.profile.entitledFeatures} />
                  <Stat label="Open tickets" value={org.profile.openTickets} />
                  <Stat label="Webhooks" value={org.profile.webhookEndpoints} />
                  <Stat label="API keys" value={org.profile.apiKeys} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                  Integrations
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {org.profile.integrations.length === 0 ? (
                    <span className="text-sm text-[var(--cmd-fg-muted)]">None connected</span>
                  ) : null}
                  {org.profile.integrations.map((i) => (
                    <Badge key={i.provider} tone={i.status === "CONNECTED" ? "success" : "neutral"}>
                      {i.provider}: {i.status.toLowerCase()}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3">
                  <p className="text-sm font-medium">Start controlled support session</p>
                  <p className="text-xs text-[var(--cmd-fg-muted)]">
                    Read-only by default. Fully audited. Auto-expires.
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <Label htmlFor="ss-reason">Reason</Label>
                      <Input
                        id="ss-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ticket #… / diagnose integration"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ss-scope">Scope</Label>
                      <select
                        id="ss-scope"
                        className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                      >
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ").toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={startSession}
                    disabled={reason.trim().length < 4}
                  >
                    Start read-only session
                  </Button>
                </div>

                {org.sessions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                      Support access history
                    </p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {org.sessions.map((s) => (
                        <li key={s.id} className="flex items-center justify-between">
                          <span>
                            {s.staffName} · {s.scope.toLowerCase()} · {s.mode} ·{" "}
                            {new Date(s.startsAt).toLocaleString()}
                          </span>
                          {s.active ? (
                            <button
                              className="text-[var(--cmd-danger)] hover:underline"
                              onClick={() => revokeSession(s.id)}
                            >
                              revoke
                            </button>
                          ) : (
                            <span className="text-[var(--cmd-fg-muted)]">
                              {s.revokedAt ? "revoked" : "ended"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ) : (
              <div className="cmd-glass flex items-center justify-center rounded-[var(--cmd-radius-xl)] p-8 text-sm text-[var(--cmd-fg-muted)]">
                Search for an organization to view its support profile.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "tickets" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <ul className="space-y-2">
            {tickets.length === 0 ? (
              <li className="text-sm text-[var(--cmd-fg-muted)]">No tickets.</li>
            ) : null}
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => openTicket(t.id)}
                  className={`w-full rounded-[var(--cmd-radius-xl)] p-3 text-left ${ticket?.ticket.id === t.id ? "cmd-glass-strong" : "cmd-glass hover:bg-[var(--cmd-bg-muted)]"}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        t.priority === "URGENT" || t.priority === "CRITICAL" ? "danger" : "neutral"
                      }
                    >
                      {t.priority.toLowerCase()}
                    </Badge>
                    <Badge tone="neutral">{t.status.replace(/_/g, " ").toLowerCase()}</Badge>
                    <span className="text-xs text-[var(--cmd-fg-muted)]">{t.number}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-[var(--cmd-fg-muted)]">
                    {t.organizationName} · {t.requesterEmail}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {ticket ? (
              <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
                <h2 className="text-lg font-semibold">{ticket.ticket.subject}</h2>
                <p className="text-xs text-[var(--cmd-fg-muted)]">
                  {ticket.ticket.organizationName} · {ticket.ticket.category} ·{" "}
                  {ticket.ticket.number}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["ASSIGNED", "WAITING_ON_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"].map(
                    (s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        onClick={() => ticketAction("status", { status: s })}
                      >
                        {s.replace(/_/g, " ").toLowerCase()}
                      </Button>
                    ),
                  )}
                  <Button size="sm" variant="ghost" onClick={() => ticketAction("assign")}>
                    assign to me
                  </Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {ticket.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-[var(--cmd-radius)] p-2.5 text-sm ${m.internal ? "border border-[var(--cmd-warning)]/40 bg-[var(--cmd-warning)]/10" : "bg-[var(--cmd-bg-muted)]"}`}
                    >
                      <div className="flex items-center gap-2 text-xs text-[var(--cmd-fg-muted)]">
                        <span>{m.authorType}</span>
                        {m.internal ? <Badge tone="warning">internal note</Badge> : null}
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <textarea
                    className="min-h-20 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-2 text-sm"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to customer or add an internal note…"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => ticketAction("reply", { body: reply })}
                      disabled={reply.trim().length < 1}
                    >
                      Reply to customer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ticketAction("note", { body: reply })}
                      disabled={reply.trim().length < 1}
                    >
                      Add internal note
                    </Button>
                  </div>
                </div>
              </article>
            ) : (
              <div className="cmd-glass flex items-center justify-center rounded-[var(--cmd-radius-xl)] p-8 text-sm text-[var(--cmd-fg-muted)]">
                Select a ticket.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}

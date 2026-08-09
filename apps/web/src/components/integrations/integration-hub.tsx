"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";
import { ErlcConnectForm } from "@/components/integrations/erlc-connect-form";

type Card = {
  key: string;
  name: string;
  status: string;
  configured: boolean;
  health: string;
  detail: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  mode?: string;
  metrics?: Record<string, number>;
};
type Activity = { at: string; kind: string; label: string; status: string };
type Hub = { overall: string; cards: Card[]; activity: Activity[] };
type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  status: string;
  secretPrefix: string;
  consecutiveFailures: number;
};
type Delivery = {
  id: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  durationMs: number | null;
  attempts: number;
  error: string | null;
  createdAt: string;
};
type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
};
type DiscordConfig = {
  connected: boolean;
  mode: string;
  guildId: string | null;
  channels: Record<string, string>;
};

const WEBHOOK_EVENTS = [
  "Member.Created",
  "Member.Promoted",
  "Shift.Started",
  "Shift.Completed",
  "Application.Submitted",
  "Application.Approved",
  "Training.Completed",
  "Announcement.Published",
  "CAD.CallCreated",
  "Case.Created",
  "Case.Closed",
  "Evidence.Collected",
];
const API_SCOPES = [
  "members.read",
  "departments.read",
  "shifts.read",
  "applications.read",
  "server.read",
  "cad.read",
  "rms.read",
  "webhooks.manage",
];
const CHANNEL_KEYS = [
  "announcements",
  "shifts",
  "applications",
  "training",
  "audit",
  "notifications",
  "cad",
];

const statusTone: Record<string, "success" | "warning" | "accent" | "danger" | "neutral"> = {
  CONNECTED: "success",
  DEGRADED: "accent",
  CONFIGURATION_REQUIRED: "warning",
  ERROR: "danger",
  DISCONNECTED: "neutral",
  HEALTHY: "success",
  ACTION_REQUIRED: "warning",
  OUTAGE: "danger",
  active: "success",
  degraded: "accent",
  disabled: "danger",
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: { message?: string } | string }).error &&
        typeof (json as { error: unknown }).error === "object"
        ? ((json as { error: { message?: string } }).error.message ?? "Request failed")
        : "Request failed",
    );
  return json;
}

export function IntegrationHub({
  orgPublicId,
  erlcInitial,
  canDiscord,
  canWebhooks,
  canApiKeys,
}: {
  orgPublicId: string;
  erlcInitial: React.ComponentProps<typeof ErlcConnectForm>["initial"];
  canDiscord: boolean;
  canWebhooks: boolean;
  canApiKeys: boolean;
}) {
  const [hub, setHub] = useState<Hub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const [discord, setDiscord] = useState<DiscordConfig | null>(null);
  const [botToken, setBotToken] = useState("");
  const [guildId, setGuildId] = useState("");
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [discordTest, setDiscordTest] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [akName, setAkName] = useState("");
  const [akScopes, setAkScopes] = useState<string[]>(["members.read"]);
  const [newKey, setNewKey] = useState<string | null>(null);

  const notify = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3000);
  };

  const loadHub = useCallback(async () => {
    try {
      setHub(await api("/api/integrations/hub"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadHub();
    if (canDiscord)
      void api("/api/integrations/discord")
        .then((d) => {
          setDiscord(d);
          setChannels(d.channels ?? {});
        })
        .catch(() => undefined);
    if (canWebhooks)
      void api("/api/integrations/webhooks")
        .then((d) => {
          setWebhooks(d.webhooks);
          setDeliveries(d.deliveries);
        })
        .catch(() => undefined);
    if (canApiKeys)
      void api("/api/integrations/api-keys")
        .then((d) => setApiKeys(d.apiKeys))
        .catch(() => undefined);
  }, [loadHub, canDiscord, canWebhooks, canApiKeys]);

  const connectDiscord = async () => {
    try {
      await api("/api/integrations/discord", {
        method: "POST",
        body: JSON.stringify({ botToken, guildId }),
      });
      setBotToken("");
      notify("Discord connected");
      await api("/api/integrations/discord").then((d) => {
        setDiscord(d);
        setChannels(d.channels ?? {});
      });
      await loadHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const saveChannels = async () => {
    try {
      await api("/api/integrations/discord", {
        method: "PATCH",
        body: JSON.stringify({ channels }),
      });
      notify("Channels saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const testDiscord = async () => {
    try {
      const d = await api("/api/integrations/discord", {
        method: "POST",
        body: JSON.stringify({ action: "test" }),
      });
      setDiscordTest(
        `${d.note} Guild reachable: ${d.guildReachable ? "yes" : "no"}. Missing channels: ${d.missingChannels.length ? d.missingChannels.join(", ") : "none"}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api("/api/integrations/webhooks", {
        method: "POST",
        body: JSON.stringify({ name: whName, url: whUrl, events: whEvents }),
      });
      setNewSecret(res.secret);
      setWhName("");
      setWhUrl("");
      setWhEvents([]);
      await api("/api/integrations/webhooks").then((d) => {
        setWebhooks(d.webhooks);
        setDeliveries(d.deliveries);
      });
      await loadHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const webhookAction = async (id: string, action: string) => {
    try {
      const res = await api(`/api/integrations/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      if (action === "rotate") setNewSecret(res.secret);
      if (action === "test")
        notify(
          `Test delivery: ${res.delivery.status}${res.delivery.httpStatus ? ` (${res.delivery.httpStatus})` : ""}`,
        );
      await api("/api/integrations/webhooks").then((d) => {
        setWebhooks(d.webhooks);
        setDeliveries(d.deliveries);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  const deleteWebhook = async (id: string) => {
    await api(`/api/integrations/webhooks/${id}`, { method: "DELETE" }).catch((e) =>
      setError(e.message),
    );
    await api("/api/integrations/webhooks").then((d) => {
      setWebhooks(d.webhooks);
      setDeliveries(d.deliveries);
    });
    await loadHub();
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api("/api/integrations/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: akName, scopes: akScopes }),
      });
      setNewKey(res.plaintext);
      setAkName("");
      await api("/api/integrations/api-keys").then((d) => setApiKeys(d.apiKeys));
      await loadHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const revokeKey = async (id: string) => {
    await api(`/api/integrations/api-keys/${id}`, { method: "DELETE" }).catch((e) =>
      setError(e.message),
    );
    await api("/api/integrations/api-keys").then((d) => setApiKeys(d.apiKeys));
  };

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
            Integration Hub
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">Connections</h1>
        </div>
        {hub ? (
          <Badge tone={statusTone[hub.overall] ?? "neutral"}>
            {hub.overall.replace(/_/g, " ").toLowerCase()}
          </Badge>
        ) : null}
      </header>

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

      {/* Cards */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(hub?.cards ?? []).map((c) => (
          <button
            key={c.key}
            onClick={() => setOpen(open === c.key ? null : c.key)}
            className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 text-left hover:bg-[var(--cmd-bg-muted)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <Badge tone={statusTone[c.status] ?? "neutral"}>
                {c.status.replace(/_/g, " ").toLowerCase()}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">{c.health}</p>
            <p className="mt-0.5 text-xs text-[var(--cmd-fg-muted)]">
              {c.detail}
              {c.lastSuccessAt ? ` · last ok ${new Date(c.lastSuccessAt).toLocaleString()}` : ""}
            </p>
            {c.lastError ? (
              <p className="mt-0.5 text-xs text-[var(--cmd-danger)]">{c.lastError}</p>
            ) : null}
          </button>
        ))}
      </section>

      {/* ER:LC */}
      {open === "erlc" ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <h2 className="mb-3 font-medium">ER:LC / PRC</h2>
          <ErlcConnectForm orgPublicId={orgPublicId} initial={erlcInitial} />
        </section>
      ) : null}

      {/* Discord */}
      {open === "discord" && canDiscord ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 space-y-3">
          <h2 className="font-medium">Discord</h2>
          {discord?.connected ? (
            <p className="text-sm text-[var(--cmd-fg-muted)]">
              Connected ({discord.mode}) · guild {discord.guildId}
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Bot token"
                type="password"
              />
              <Input
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="Guild ID"
              />
              <Button size="sm" onClick={connectDiscord}>
                Connect
              </Button>
            </div>
          )}
          {discord?.connected ? (
            <>
              <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                Channel mapping
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {CHANNEL_KEYS.map((k) => (
                  <div key={k}>
                    <Label htmlFor={`ch-${k}`}>{k}</Label>
                    <Input
                      id={`ch-${k}`}
                      value={channels[k] ?? ""}
                      onChange={(e) => setChannels({ ...channels, [k]: e.target.value })}
                      placeholder="channel id"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={saveChannels}>
                  Save channels
                </Button>
                <Button size="sm" variant="outline" onClick={testDiscord}>
                  Test Discord integration
                </Button>
              </div>
              {discordTest ? (
                <p className="text-sm text-[var(--cmd-fg-muted)]">{discordTest}</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {/* Webhooks */}
      {open === "webhooks" && canWebhooks ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 space-y-3">
          <h2 className="font-medium">Outgoing Webhooks</h2>
          {newSecret ? (
            <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-warning)]/40 bg-[var(--cmd-warning)]/10 p-3 text-sm">
              Signing secret (shown once): <code className="font-mono">{newSecret}</code>{" "}
              <button className="ml-2 underline" onClick={() => setNewSecret(null)}>
                dismiss
              </button>
            </div>
          ) : null}
          <form onSubmit={createWebhook} className="space-y-2">
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Name"
                required
              />
              <Input
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                required
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  type="button"
                  key={ev}
                  onClick={() => toggle(whEvents, ev, setWhEvents)}
                  className={`rounded-[var(--cmd-radius-pill)] px-2.5 py-1 text-xs ${whEvents.includes(ev) ? "bg-[var(--cmd-accent)]/20" : "bg-[var(--cmd-bg-muted)]"}`}
                >
                  {ev}
                </button>
              ))}
            </div>
            <Button size="sm" type="submit" disabled={whEvents.length === 0}>
              Create endpoint
            </Button>
          </form>
          <ul className="space-y-2">
            {webhooks.map((w) => (
              <li
                key={w.id}
                className="rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Badge tone={statusTone[w.status] ?? "neutral"}>{w.status}</Badge>{" "}
                    <span className="ml-2 font-medium">{w.name}</span>{" "}
                    <span className="text-xs text-[var(--cmd-fg-muted)]">{w.url}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => webhookAction(w.id, "test")}>
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => webhookAction(w.id, "rotate")}
                    >
                      Rotate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => webhookAction(w.id, w.enabled ? "disable" : "enable")}
                    >
                      {w.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteWebhook(w.id)}>
                      Delete
                    </Button>
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">{w.events.join(", ")}</p>
              </li>
            ))}
          </ul>
          {deliveries.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                Recent deliveries
              </p>
              <ul className="mt-1 space-y-1">
                {deliveries.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs">
                    <span>
                      <Badge
                        tone={
                          d.status === "SUCCESS"
                            ? "success"
                            : d.status === "FAILED"
                              ? "danger"
                              : "accent"
                        }
                      >
                        {d.status.toLowerCase()}
                      </Badge>{" "}
                      {d.eventType}
                    </span>
                    <span className="text-[var(--cmd-fg-muted)]">
                      {d.httpStatus ?? "—"} · {d.durationMs ?? "—"}ms · {d.attempts} try
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* API keys */}
      {open === "api_keys" && canApiKeys ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 space-y-3">
          <h2 className="font-medium">Ordinex API Keys</h2>
          {newKey ? (
            <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-warning)]/40 bg-[var(--cmd-warning)]/10 p-3 text-sm">
              API key (shown once): <code className="font-mono break-all">{newKey}</code>{" "}
              <button className="ml-2 underline" onClick={() => setNewKey(null)}>
                dismiss
              </button>
            </div>
          ) : null}
          <form onSubmit={createKey} className="space-y-2">
            <Input
              value={akName}
              onChange={(e) => setAkName(e.target.value)}
              placeholder="Key name"
              required
              className="max-w-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {API_SCOPES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggle(akScopes, s, setAkScopes)}
                  className={`rounded-[var(--cmd-radius-pill)] px-2.5 py-1 text-xs ${akScopes.includes(s) ? "bg-[var(--cmd-accent)]/20" : "bg-[var(--cmd-bg-muted)]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button size="sm" type="submit" disabled={akScopes.length === 0}>
              Create API key
            </Button>
          </form>
          <ul className="space-y-1">
            {apiKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--cmd-radius)] bg-[var(--cmd-bg-muted)] px-3 py-2 text-sm"
              >
                <span>
                  <Badge tone={k.status === "active" ? "success" : "neutral"}>{k.status}</Badge>{" "}
                  <span className="ml-2 font-medium">{k.name}</span>{" "}
                  <code className="ml-2 font-mono text-xs text-[var(--cmd-fg-muted)]">
                    {k.prefix}…
                  </code>
                </span>
                <span className="flex items-center gap-2 text-xs text-[var(--cmd-fg-muted)]">
                  {k.scopes.join(", ")}{" "}
                  {k.status === "active" ? (
                    <button className="underline" onClick={() => revokeKey(k.id)}>
                      revoke
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Activity */}
      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="mb-2 font-medium">Integration activity</h2>
        {(hub?.activity ?? []).length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No recent activity.</p>
        ) : null}
        <ul className="space-y-1">
          {(hub?.activity ?? []).slice(0, 12).map((a, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span>
                <Badge
                  tone={
                    a.status === "success" || a.status === "ok"
                      ? "success"
                      : a.status === "failed"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {a.kind}
                </Badge>{" "}
                <span className="ml-2">{a.label}</span>
              </span>
              <span className="text-xs text-[var(--cmd-fg-muted)]">
                {new Date(a.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

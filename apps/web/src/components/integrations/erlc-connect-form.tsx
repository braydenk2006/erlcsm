"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, PlugZap, ShieldCheck, XCircle } from "lucide-react";
import { Badge, Button, Input, Label } from "@commandry/ui";

type IntegrationSummary = {
  connected: boolean;
  mode: string;
  status: string;
  label: string | null;
  hasCredentials: boolean;
  webhookConfigured: boolean;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "CONNECTED") return "success";
  if (status === "DEGRADED") return "warning";
  if (status === "ERROR") return "danger";
  return "neutral";
}

export function ErlcConnectForm({
  initial,
  orgPublicId,
}: {
  initial: IntegrationSummary;
  orgPublicId: string;
}) {
  const [integration, setIntegration] = useState<IntegrationSummary>(initial);
  const [serverKey, setServerKey] = useState("");
  const [globalKey, setGlobalKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState<null | "connect" | "test" | "disconnect">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/integrations/erlc/webhook/${orgPublicId}`
      : `/api/integrations/erlc/webhook/${orgPublicId}`;

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/erlc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverKey,
          globalKey: globalKey || undefined,
          webhookSecret: webhookSecret || undefined,
        }),
      });
      const json = (await res.json()) as { integration?: IntegrationSummary; error?: string };
      if (!res.ok || !json.integration) {
        setMessage({ ok: false, text: json.error ?? "Failed to connect" });
      } else {
        setIntegration(json.integration);
        setServerKey("");
        setMessage({ ok: true, text: "Credentials stored (encrypted) and validated." });
      }
    } catch {
      setMessage({ ok: false, text: "Request failed" });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/erlc/test", { method: "POST" });
      const json = (await res.json()) as {
        integration?: IntegrationSummary;
        health?: { status: string; message: string; latencyMs: number | null };
      };
      if (json.integration) setIntegration(json.integration);
      if (json.health) {
        setMessage({
          ok: json.health.status === "connected",
          text: `${json.health.message}${json.health.latencyMs != null ? ` (${json.health.latencyMs}ms)` : ""}`,
        });
      }
    } catch {
      setMessage({ ok: false, text: "Health check failed" });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setMessage(null);
    try {
      await fetch("/api/integrations/erlc", { method: "DELETE" });
      setIntegration({
        ...integration,
        connected: false,
        status: "DISCONNECTED",
        hasCredentials: false,
        webhookConfigured: false,
        lastError: null,
      });
      setMessage({ ok: true, text: "Disconnected." });
    } catch {
      setMessage({ ok: false, text: "Request failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[var(--cmd-accent)]" />
            <div>
              <h2 className="font-semibold">ER:LC Server</h2>
              <p className="text-xs text-[var(--cmd-fg-muted)]">
                Mode: {integration.mode} · Server key stored with AES-256-GCM encryption
              </p>
            </div>
          </div>
          <Badge tone={statusTone(integration.status)}>{integration.status}</Badge>
        </div>

        {integration.lastError ? (
          <p className="mt-3 text-sm text-[var(--cmd-danger)]">{integration.lastError}</p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="serverKey">Server key</Label>
            <Input
              id="serverKey"
              value={serverKey}
              onChange={(e) => setServerKey(e.target.value)}
              placeholder={
                integration.hasCredentials
                  ? "•••••••• (stored) — enter to replace"
                  : "ER:LC server key"
              }
              className="font-[family-name:var(--cmd-font-mono)] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="globalKey">Global API key (optional)</Label>
            <Input
              id="globalKey"
              value={globalKey}
              onChange={(e) => setGlobalKey(e.target.value)}
              placeholder="Higher rate limits"
              className="font-[family-name:var(--cmd-font-mono)] text-sm"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="webhookSecret">Webhook secret (optional)</Label>
            <Input
              id="webhookSecret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Used to HMAC-verify inbound 911/CAD webhooks"
              className="font-[family-name:var(--cmd-font-mono)] text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => void connect()}
            disabled={busy !== null || !serverKey.trim()}
            size="sm"
          >
            {busy === "connect" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            {integration.hasCredentials ? "Update credentials" : "Connect"}
          </Button>
          <Button onClick={() => void test()} disabled={busy !== null} variant="outline" size="sm">
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Test connection
          </Button>
          {integration.hasCredentials ? (
            <Button
              onClick={() => void disconnect()}
              disabled={busy !== null}
              variant="ghost"
              size="sm"
            >
              Disconnect
            </Button>
          ) : null}
        </div>

        {message ? (
          <p
            className={`mt-3 flex items-center gap-2 text-sm ${message.ok ? "text-[var(--cmd-success)]" : "text-[var(--cmd-danger)]"}`}
          >
            {message.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
        <h3 className="font-semibold">Emergency-call webhook</h3>
        <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">
          Point your ER:LC / CAD relay here. Requests are HMAC-SHA256 verified against the webhook
          secret above and synchronized into CAD.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 py-2 font-[family-name:var(--cmd-font-mono)] text-xs">
            {webhookUrl}
          </code>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy webhook URL"
            onClick={() => {
              void navigator.clipboard?.writeText(webhookUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--cmd-success)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--cmd-fg-muted)]">
          Webhook verification: {integration.webhookConfigured ? "configured" : "not configured"}
        </p>
      </div>
    </div>
  );
}

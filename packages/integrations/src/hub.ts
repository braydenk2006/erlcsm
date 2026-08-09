import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Integration Hub — pure helpers (deterministic health, SSRF guard, webhook
 * signing/backoff, API-key generation + scopes). No IO; the service layer
 * persists and enforces permissions. This does NOT replace any existing
 * integration — it organizes and hardens them.
 */

// ---------------------------------------------------------------------------
// Integration status + deterministic overall health
// ---------------------------------------------------------------------------

export const INTEGRATION_STATUSES = [
  "CONNECTED",
  "DEGRADED",
  "ERROR",
  "DISCONNECTED",
  "CONFIGURATION_REQUIRED",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const OVERALL_HEALTH = ["HEALTHY", "DEGRADED", "ACTION_REQUIRED", "OUTAGE"] as const;
export type OverallHealth = (typeof OVERALL_HEALTH)[number];

/**
 * Deterministic overall health from the per-integration card statuses.
 * DISCONNECTED integrations that were never configured do not count against
 * health (the org simply isn't using them).
 */
export function computeOverallHealth(
  cards: { status: IntegrationStatus; configured: boolean }[],
): OverallHealth {
  const active = cards.filter((c) => c.configured || c.status !== "DISCONNECTED");
  if (active.some((c) => c.status === "ERROR")) return "OUTAGE";
  if (active.some((c) => c.status === "CONFIGURATION_REQUIRED")) return "ACTION_REQUIRED";
  if (active.some((c) => c.status === "DEGRADED")) return "DEGRADED";
  return "HEALTHY";
}

// ---------------------------------------------------------------------------
// SSRF guard for configurable webhook destinations
// ---------------------------------------------------------------------------

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local / cloud metadata
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fe80:/i,
  /\.internal$/i,
  /\.local$/i,
  /^metadata\./i,
];

/** Validate a user-supplied webhook URL. Must be public HTTPS (no SSRF targets). */
export function isSafeWebhookUrl(
  raw: string,
  allowInsecure = false,
): { ok: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:"))
    return { ok: false, reason: "Webhook URLs must use HTTPS" };
  const host = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host)))
    return { ok: false, reason: "Private, loopback, and metadata hosts are not allowed" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Webhook signing + retry backoff
// ---------------------------------------------------------------------------

export function signWebhookPayload(body: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export const WEBHOOK_MAX_ATTEMPTS = 5;

export function webhookBackoffMs(attempt: number, baseMs = 2000, capMs = 300_000): number {
  return Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
}

// ---------------------------------------------------------------------------
// API keys (cryptographically secure, hashed at rest, shown once)
// ---------------------------------------------------------------------------

export const API_SCOPES = [
  "members.read",
  "departments.read",
  "shifts.read",
  "applications.read",
  "server.read",
  "cad.read",
  "rms.read",
  "webhooks.manage",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Generate a new API key. The plaintext is returned once and never stored. */
export function generateApiKey(): { plaintext: string; hashed: string; prefix: string } {
  const plaintext = `ordx_${randomBytes(24).toString("base64url")}`;
  return { plaintext, hashed: hashApiKey(plaintext), prefix: plaintext.slice(0, 12) };
}

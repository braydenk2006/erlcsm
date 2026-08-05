/**
 * Central numeric-limit registry. Contract / "unlimited" limits use a large but
 * finite sentinel so the backend always keeps a real abuse-prevention ceiling —
 * there is no literal Infinity.
 */

export type LimitKey =
  | "organizations.max"
  | "members.max"
  | "departments.max"
  | "storage.bytes"
  | "erlc_servers.max"
  | "discord_servers.max"
  | "website_pages.max"
  | "ai_requests.monthly"
  | "api_requests.monthly"
  | "webhooks.max"
  | "automations.max"
  | "scheduled_reports.max"
  | "retention_days";

export type LimitUnit = "count" | "bytes" | "days";

export type LimitDef = { key: LimitKey; label: string; unit: LimitUnit };

export const LIMIT_DEFS: LimitDef[] = [
  { key: "organizations.max", label: "Organizations", unit: "count" },
  { key: "members.max", label: "Members", unit: "count" },
  { key: "departments.max", label: "Departments", unit: "count" },
  { key: "storage.bytes", label: "Storage", unit: "bytes" },
  { key: "erlc_servers.max", label: "ER:LC servers", unit: "count" },
  { key: "discord_servers.max", label: "Discord servers", unit: "count" },
  { key: "website_pages.max", label: "Published website pages", unit: "count" },
  { key: "ai_requests.monthly", label: "Monthly AI requests", unit: "count" },
  { key: "api_requests.monthly", label: "Monthly API requests", unit: "count" },
  { key: "webhooks.max", label: "Webhook endpoints", unit: "count" },
  { key: "automations.max", label: "Automations", unit: "count" },
  { key: "scheduled_reports.max", label: "Scheduled reports", unit: "count" },
  { key: "retention_days", label: "Data retention", unit: "days" },
];

const LIMIT_KEY_SET = new Set<string>(LIMIT_DEFS.map((limit) => limit.key));

export function isLimitKey(value: string): value is LimitKey {
  return LIMIT_KEY_SET.has(value);
}

/**
 * Sentinel for "contract-defined / effectively unlimited" limits. Finite so the
 * backend still enforces a hard abuse-prevention ceiling; the UI renders it as
 * "Unlimited" (or "Contract" for Enterprise).
 */
export const CONTRACT_LIMIT = 1_000_000_000;

export function isUnlimited(value: number): boolean {
  return value >= CONTRACT_LIMIT;
}

export function formatLimit(key: LimitKey, value: number, enterprise = false): string {
  if (isUnlimited(value)) return enterprise ? "Contract" : "Unlimited";
  const def = LIMIT_DEFS.find((limit) => limit.key === key);
  if (def?.unit === "bytes") {
    const gb = value / 1_073_741_824;
    return gb >= 1
      ? `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`
      : `${Math.round(value / 1_048_576)} MB`;
  }
  if (def?.unit === "days") return `${value} days`;
  return value.toLocaleString("en-US");
}

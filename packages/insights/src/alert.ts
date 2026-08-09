/**
 * Alert Engine — maps insight severity to an alert level and defines the alert
 * lifecycle. Alerts are generated from insights (deterministic) and feed the
 * Command Center, Notifications, and the Automation Platform.
 */
import type { Severity } from "./kpi";

export const ALERT_LEVELS = ["information", "success", "attention", "warning", "critical"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_STATUSES = [
  "open",
  "acknowledged",
  "dismissed",
  "resolved",
  "escalated",
  "expired",
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

const TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  open: ["acknowledged", "dismissed", "resolved", "escalated", "expired"],
  acknowledged: ["resolved", "escalated", "dismissed", "expired"],
  escalated: ["acknowledged", "resolved", "dismissed", "expired"],
  dismissed: [],
  resolved: [],
  expired: [],
};

export function canTransitionAlert(from: AlertStatus, to: AlertStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function alertLevelForSeverity(severity: Severity): AlertLevel {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "attention":
      return "attention";
    case "excellent":
      return "success";
    default:
      return "information";
  }
}

/** Only warning/critical insights should raise a (actionable) alert. */
export function shouldRaiseAlert(severity: Severity): boolean {
  return severity === "warning" || severity === "critical";
}

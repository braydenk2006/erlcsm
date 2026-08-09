/**
 * Executive summary — a deterministic daily operational digest. No AI. Turns the
 * aggregated snapshot into a short list of "what needs attention" sentences,
 * ordered by urgency.
 */
import type { Severity } from "./health";

export type SummaryInputs = {
  pendingApplications: number;
  assignedToMe: number;
  outstandingWorkflows: number;
  shiftsStartingSoon: number;
  trainingOverdue: number;
  automationFailures: number;
  automationSuccessRate: number;
  serverOnline: boolean;
  healthSeverity: Severity;
  understaffedDepartments: number;
};

export type SummaryLine = { text: string; severity: Severity };

export function buildExecutiveSummary(i: SummaryInputs): SummaryLine[] {
  const lines: SummaryLine[] = [];

  if (i.shiftsStartingSoon > 0) {
    lines.push({
      text: `${i.shiftsStartingSoon} ${i.shiftsStartingSoon === 1 ? "operation begins" : "operations begin"} within the next hour.`,
      severity: "attention",
    });
  }
  if (i.assignedToMe > 0) {
    lines.push({
      text: `${i.assignedToMe} ${i.assignedToMe === 1 ? "item is" : "items are"} assigned to you for review.`,
      severity: "warning",
    });
  }
  if (i.pendingApplications > 0) {
    lines.push({
      text: `${i.pendingApplications} ${i.pendingApplications === 1 ? "application requires" : "applications require"} review.`,
      severity: i.pendingApplications >= 5 ? "warning" : "attention",
    });
  }
  if (i.outstandingWorkflows > 0) {
    lines.push({
      text: `${i.outstandingWorkflows} ${i.outstandingWorkflows === 1 ? "workflow needs" : "workflows need"} action.`,
      severity: "attention",
    });
  }
  if (i.trainingOverdue > 0) {
    lines.push({
      text: `${i.trainingOverdue} ${i.trainingOverdue === 1 ? "member has" : "members have"} overdue training.`,
      severity: "attention",
    });
  }
  if (i.automationFailures > 0) {
    lines.push({
      text: `${i.automationFailures} automation ${i.automationFailures === 1 ? "run" : "runs"} failed and ${i.automationFailures === 1 ? "needs" : "need"} attention.`,
      severity: "warning",
    });
  }
  if (!i.serverOnline) {
    lines.push({ text: "The linked ER:LC server is offline.", severity: "critical" });
  }
  if (i.understaffedDepartments > 0) {
    lines.push({
      text: `${i.understaffedDepartments} ${i.understaffedDepartments === 1 ? "department is" : "departments are"} understaffed.`,
      severity: "attention",
    });
  }

  // Nothing actionable — one calm line (no informational notes drown it out).
  if (lines.length === 0) {
    return [
      {
        text: "Everything looks calm — no items need your attention right now.",
        severity: "excellent",
      },
    ];
  }
  // Reassurance note appended only alongside real items.
  if (i.automationFailures === 0 && i.automationSuccessRate >= 0.9) {
    lines.push({ text: "Automation success remains above target.", severity: "healthy" });
  }
  return lines;
}

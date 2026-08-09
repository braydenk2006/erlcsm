/**
 * Workflow Platform — workflow engine.
 *
 * A workflow is an ordered set of stages with configurable approval and reviewer
 * assignment. Pure logic here decides how a submission advances; the service
 * layer persists and emits events. No feature writes its own approval logic.
 */

export const SUBMISSION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "DENIED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type ApprovalMode = "SINGLE" | "ALL" | "ANY" | "AUTO";
export type AssignmentStrategy =
  "MANUAL" | "DEPARTMENT" | "ROLE" | "ROUND_ROBIN" | "SPECIFIC_USER" | "SUBMITTER";

export type WorkflowStage = {
  id: string;
  name: string;
  /** Approval requirement to leave this stage. */
  approvalMode: ApprovalMode;
  assignment: {
    strategy: AssignmentStrategy;
    /** role key / department id / specific membership id, per strategy. */
    target?: string | null;
  };
  /** Next stage id when this stage approves, or "COMPLETE" to finish. */
  onApprove: string | "COMPLETE";
  /** Whether reviewers at this stage may request a revision. */
  allowRevision?: boolean;
};

export type WorkflowDefinition = {
  stages: WorkflowStage[];
  initialStageId: string;
};

export function getStage(def: WorkflowDefinition, stageId: string | null): WorkflowStage | null {
  if (!stageId) return null;
  return def.stages.find((s) => s.id === stageId) ?? null;
}

export type Decision = "APPROVE" | "DENY" | "REVISE";

/**
 * Given the assigned reviewers' decisions at a stage, determine the outcome.
 * `assignedCount` is the number of reviewers whose approval is expected (for ALL).
 */
export function evaluateStage(
  stage: WorkflowStage,
  decisions: Decision[],
  assignedCount: number,
): "advance" | "deny" | "revise" | "pending" {
  if (stage.approvalMode === "AUTO") return "advance";
  if (decisions.includes("DENY")) return "deny";
  if (stage.allowRevision && decisions.includes("REVISE")) return "revise";
  const approvals = decisions.filter((d) => d === "APPROVE").length;
  if (stage.approvalMode === "ALL") {
    return approvals >= Math.max(1, assignedCount) ? "advance" : "pending";
  }
  // SINGLE / ANY
  return approvals >= 1 ? "advance" : "pending";
}

/** Resolve the next status + stage after a stage outcome. */
export function applyOutcome(
  def: WorkflowDefinition,
  stage: WorkflowStage,
  outcome: "advance" | "deny" | "revise",
): { status: SubmissionStatus; stageId: string | null } {
  if (outcome === "deny") return { status: "DENIED", stageId: stage.id };
  if (outcome === "revise") return { status: "REVISION_REQUESTED", stageId: stage.id };
  if (stage.onApprove === "COMPLETE") return { status: "COMPLETED", stageId: null };
  const next = getStage(def, stage.onApprove);
  return { status: next ? "IN_REVIEW" : "COMPLETED", stageId: next?.id ?? null };
}

/**
 * Round-robin / load-balanced reviewer pick: the candidate with the fewest open
 * assignments (ties broken by order). Pure — the service supplies workloads.
 */
export function pickReviewer(
  candidates: string[],
  workload: Record<string, number>,
): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestLoad = workload[best] ?? 0;
  for (const c of candidates.slice(1)) {
    const load = workload[c] ?? 0;
    if (load < bestLoad) {
      best = c;
      bestLoad = load;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Events (automation hooks + timeline)
// ---------------------------------------------------------------------------

export const WORKFLOW_EVENTS = [
  "SUBMISSION_CREATED",
  "DRAFT_SAVED",
  "SUBMISSION_SUBMITTED",
  "REVIEWER_ASSIGNED",
  "COMMENT_ADDED",
  "NOTE_ADDED",
  "STAGE_CHANGED",
  "REVISION_REQUESTED",
  "RESUBMITTED",
  "SUBMISSION_APPROVED",
  "SUBMISSION_DENIED",
  "SUBMISSION_COMPLETED",
  "ATTACHMENT_UPLOADED",
  "DEADLINE_PASSED",
  "SUBMISSION_ARCHIVED",
] as const;
export type WorkflowEventType = (typeof WORKFLOW_EVENTS)[number];

export type CommentVisibility = "APPLICANT" | "INTERNAL";

export const TERMINAL_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  "COMPLETED",
  "DENIED",
  "CANCELLED",
  "ARCHIVED",
]);

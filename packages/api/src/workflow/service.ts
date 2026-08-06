import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import {
  BUILT_IN_TEMPLATES,
  applyOutcome,
  evaluateStage,
  getStage,
  pickReviewer,
  sanitizeSubmissionData,
  validateSubmission,
  type CommentVisibility,
  type FormSchema,
  type WorkflowDefinition,
  type WorkflowEventType,
  type WorkflowStage,
} from "@commandry/workflow";
import { createNotification } from "../notifications/service";
import { publishEvent } from "../automation/service";

function has(actor: Actor, organizationId: string, action: Action): boolean {
  return authorize({ actor, organizationId, action }).allowed;
}
function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!has(actor, organizationId, action)) throw new ForbiddenError("Not permitted");
}

async function recordEvent(
  organizationId: string,
  submissionId: string,
  type: WorkflowEventType,
  actorUserId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await prisma.workflowEvent.create({
    data: { organizationId, submissionId, type, actorUserId, metadata: metadata as object },
  });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateView = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  form: FormSchema;
  workflow: WorkflowDefinition;
  isBuiltIn: boolean;
  submitRoleKeys: string[];
  reviewRoleKeys: string[];
};

/** Seed the built-in templates for an org (idempotent upsert by key). */
export async function ensureBuiltInTemplates(organizationId: string): Promise<void> {
  for (const t of BUILT_IN_TEMPLATES) {
    await prisma.workflowTemplate.upsert({
      where: { organizationId_key: { organizationId, key: t.key } },
      create: {
        publicId: createPublicId("wft"),
        organizationId,
        key: t.key,
        name: t.name,
        category: t.category,
        description: t.description,
        form: t.form as object,
        workflow: t.workflow as object,
        isBuiltIn: true,
        submitRoleKeys: [],
        reviewRoleKeys: ["owner", "admin"],
      },
      update: {},
    });
  }
}

function toTemplateView(t: {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  form: unknown;
  workflow: unknown;
  isBuiltIn: boolean;
  submitRoleKeys: string[];
  reviewRoleKeys: string[];
}): TemplateView {
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    category: t.category,
    description: t.description,
    form: t.form as FormSchema,
    workflow: t.workflow as WorkflowDefinition,
    isBuiltIn: t.isBuiltIn,
    submitRoleKeys: t.submitRoleKeys,
    reviewRoleKeys: t.reviewRoleKeys,
  };
}

export async function listTemplates(input: {
  actor: Actor;
  organizationId: string;
  category?: string;
}): Promise<TemplateView[]> {
  await ensureBuiltInTemplates(input.organizationId);
  const templates = await prisma.workflowTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      active: true,
      ...(input.category ? { category: input.category } : {}),
    },
    orderBy: { name: "asc" },
  });
  return templates.map(toTemplateView);
}

export async function createTemplate(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  category: string;
  description?: string;
  form: FormSchema;
  workflow: WorkflowDefinition;
  submitRoleKeys?: string[];
  reviewRoleKeys?: string[];
}): Promise<TemplateView> {
  requirePerm(input.actor, input.organizationId, "application:manage");
  if (input.name.trim().length < 2) throw new ValidationError("Template name is too short");
  if (!input.workflow.stages.length)
    throw new ValidationError("A workflow needs at least one stage");
  const key = `${input.category}_${input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40)}_${Date.now().toString(36)}`;
  const created = await prisma.workflowTemplate.create({
    data: {
      publicId: createPublicId("wft"),
      organizationId: input.organizationId,
      key,
      name: input.name.trim(),
      category: input.category,
      description: input.description ?? null,
      form: input.form as object,
      workflow: input.workflow as object,
      submitRoleKeys: input.submitRoleKeys ?? [],
      reviewRoleKeys: input.reviewRoleKeys ?? ["owner", "admin"],
      createdByUserId: input.actor.userId,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "application:manage",
    resourceType: "workflow_template",
    resourceId: created.id,
    source: "WEB",
    metadata: { action: "create", category: input.category },
  }).catch(() => undefined);
  return toTemplateView(created);
}

async function requireTemplate(organizationId: string, templateId: string) {
  const t = await prisma.workflowTemplate.findFirst({ where: { id: templateId, organizationId } });
  if (!t) throw new NotFoundError("Template not found");
  return t;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export type SubmissionView = {
  id: string;
  publicId: string;
  templateId: string;
  templateName: string;
  category: string;
  status: string;
  currentStageId: string | null;
  currentStageName: string | null;
  data: Record<string, unknown>;
  submitterName: string;
  submittedAt: string | null;
  completedAt: string | null;
  canReview: boolean;
  isSubmitter: boolean;
};

function canReviewTemplate(actor: Actor, reviewRoleKeys: string[]): boolean {
  return actor.roleKeys.some((r) => reviewRoleKeys.includes(r));
}
function canSubmitTemplate(actor: Actor, submitRoleKeys: string[]): boolean {
  return submitRoleKeys.length === 0 || actor.roleKeys.some((r) => submitRoleKeys.includes(r));
}

export async function createDraft(input: {
  actor: Actor;
  organizationId: string;
  templateId: string;
}): Promise<{ id: string }> {
  const template = await requireTemplate(input.organizationId, input.templateId);
  if (!canSubmitTemplate(input.actor, template.submitRoleKeys)) {
    throw new ForbiddenError("You cannot submit this form");
  }
  const submission = await prisma.workflowSubmission.create({
    data: {
      publicId: createPublicId("wfs"),
      organizationId: input.organizationId,
      templateId: template.id,
      submitterMembershipId: input.actor.membershipId,
      submitterUserId: input.actor.userId,
      status: "DRAFT",
      data: {},
    },
  });
  await recordEvent(input.organizationId, submission.id, "SUBMISSION_CREATED", input.actor.userId);
  return { id: submission.id };
}

async function requireSubmission(organizationId: string, id: string) {
  const s = await prisma.workflowSubmission.findFirst({
    where: { id, organizationId },
    include: { template: true },
  });
  if (!s) throw new NotFoundError("Submission not found");
  return s;
}

export async function saveDraft(input: {
  actor: Actor;
  organizationId: string;
  submissionId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const s = await requireSubmission(input.organizationId, input.submissionId);
  if (s.submitterMembershipId !== input.actor.membershipId)
    throw new ForbiddenError("Not your submission");
  if (!["DRAFT", "REVISION_REQUESTED"].includes(s.status))
    throw new ValidationError("This submission can no longer be edited");
  const clean = sanitizeSubmissionData(s.template.form as FormSchema, input.data);
  await prisma.workflowSubmission.update({ where: { id: s.id }, data: { data: clean as object } });
  await recordEvent(input.organizationId, s.id, "DRAFT_SAVED", input.actor.userId);
}

/** Resolve the reviewer membership ids for a stage per its assignment strategy. */
async function resolveAssignees(
  organizationId: string,
  stage: WorkflowStage,
  submitterMembershipId: string,
): Promise<string[]> {
  const strat = stage.assignment.strategy;
  if (strat === "SUBMITTER") return [submitterMembershipId];
  if (strat === "MANUAL") return [];
  if (strat === "SPECIFIC_USER") return stage.assignment.target ? [stage.assignment.target] : [];

  let candidates: { id: string }[] = [];
  if (strat === "ROLE" || strat === "ROUND_ROBIN") {
    const roleKey = stage.assignment.target ?? "admin";
    candidates = await prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE", roles: { some: { role: { key: roleKey } } } },
      select: { id: true },
    });
  } else if (strat === "DEPARTMENT") {
    candidates = await prisma.membership.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        departmentMembers: { some: { departmentId: stage.assignment.target ?? "" } },
      },
      select: { id: true },
    });
  }
  if (candidates.length === 0) return [];
  if (strat === "ROUND_ROBIN") {
    const ids = candidates.map((c) => c.id);
    const open = await prisma.workflowAssignment.groupBy({
      by: ["assigneeMembershipId"],
      where: { organizationId, assigneeMembershipId: { in: ids }, decision: null },
      _count: { _all: true },
    });
    const workload = Object.fromEntries(open.map((o) => [o.assigneeMembershipId, o._count._all]));
    const picked = pickReviewer(ids, workload);
    return picked ? [picked] : [];
  }
  return candidates.map((c) => c.id);
}

async function assignStage(
  organizationId: string,
  submissionId: string,
  stage: WorkflowStage,
  submitterMembershipId: string,
  actorUserId: string | null,
): Promise<number> {
  const assignees = await resolveAssignees(organizationId, stage, submitterMembershipId);
  for (const membershipId of assignees) {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) continue;
    await prisma.workflowAssignment.create({
      data: {
        organizationId,
        submissionId,
        stageId: stage.id,
        assigneeMembershipId: membershipId,
        assigneeUserId: membership.userId,
      },
    });
    await recordEvent(organizationId, submissionId, "REVIEWER_ASSIGNED", actorUserId, {
      stageId: stage.id,
      membershipId,
    });
    await createNotification({
      organizationId,
      userId: membership.userId,
      type: "workflow",
      title: `You have a review to complete`,
      linkUrl: "/app/applications",
      dedupeKey: `wf-assign:${submissionId}:${stage.id}:${membershipId}`,
    }).catch(() => undefined);
  }
  return assignees.length;
}

export async function submitSubmission(input: {
  actor: Actor;
  organizationId: string;
  submissionId: string;
  data?: Record<string, unknown>;
}): Promise<{ status: string }> {
  const s = await requireSubmission(input.organizationId, input.submissionId);
  if (s.submitterMembershipId !== input.actor.membershipId)
    throw new ForbiddenError("Not your submission");
  if (!["DRAFT", "REVISION_REQUESTED"].includes(s.status))
    throw new ValidationError("Already submitted");

  const schema = s.template.form as FormSchema;
  const merged = input.data
    ? sanitizeSubmissionData(schema, { ...(s.data as object), ...input.data })
    : (s.data as Record<string, unknown>);
  const result = validateSubmission(schema, merged);
  if (!result.valid) {
    throw new ValidationError("Please fix the highlighted fields", { issues: result.errors });
  }

  const def = s.template.workflow as WorkflowDefinition;
  const resubmit = s.status === "REVISION_REQUESTED";
  const stage = getStage(def, resubmit ? s.currentStageId : def.initialStageId);
  if (!stage) throw new ValidationError("Workflow has no stages");

  await prisma.workflowSubmission.update({
    where: { id: s.id },
    data: {
      data: merged as object,
      status: "IN_REVIEW",
      currentStageId: stage.id,
      submittedAt: s.submittedAt ?? new Date(),
      version: { increment: 1 },
    },
  });
  await recordEvent(
    input.organizationId,
    s.id,
    resubmit ? "RESUBMITTED" : "SUBMISSION_SUBMITTED",
    input.actor.userId,
  );

  // Reset prior decisions on this stage (for resubmission) and assign reviewers.
  await prisma.workflowAssignment.deleteMany({ where: { submissionId: s.id, stageId: stage.id } });
  const assignedCount = await assignStage(
    input.organizationId,
    s.id,
    stage,
    s.submitterMembershipId,
    input.actor.userId,
  );
  await recordEvent(input.organizationId, s.id, "STAGE_CHANGED", input.actor.userId, {
    stageId: stage.id,
  });

  // AUTO stage (e.g. training self-completion) resolves immediately.
  if (stage.approvalMode === "AUTO") {
    return advanceFrom(
      input.organizationId,
      s.id,
      def,
      stage,
      "advance",
      input.actor.userId,
      s.submitterMembershipId,
    );
  }
  if (assignedCount === 0 && stage.assignment.strategy !== "MANUAL") {
    // No eligible reviewers -> leave IN_REVIEW awaiting manual assignment.
  }
  return { status: "IN_REVIEW" };
}

async function advanceFrom(
  organizationId: string,
  submissionId: string,
  def: WorkflowDefinition,
  stage: WorkflowStage,
  outcome: "advance" | "deny" | "revise",
  actorUserId: string | null,
  submitterMembershipId: string,
): Promise<{ status: string }> {
  const { status, stageId } = applyOutcome(def, stage, outcome);
  const submission = await prisma.workflowSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      currentStageId: stageId,
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });

  if (outcome === "deny")
    await recordEvent(organizationId, submissionId, "SUBMISSION_DENIED", actorUserId);
  if (outcome === "revise")
    await recordEvent(organizationId, submissionId, "REVISION_REQUESTED", actorUserId);
  if (outcome === "advance") {
    await recordEvent(organizationId, submissionId, "SUBMISSION_APPROVED", actorUserId, {
      stageId: stage.id,
    });
    if (status === "COMPLETED") {
      await recordEvent(organizationId, submissionId, "SUBMISSION_COMPLETED", actorUserId);
    } else if (stageId) {
      const next = getStage(def, stageId)!;
      await recordEvent(organizationId, submissionId, "STAGE_CHANGED", actorUserId, { stageId });
      await assignStage(organizationId, submissionId, next, submitterMembershipId, actorUserId);
    }
  }

  await createNotification({
    organizationId,
    userId: submission.submitterUserId,
    type: "workflow",
    title: `Your submission is ${status.replace(/_/g, " ").toLowerCase()}`,
    linkUrl: "/app/applications",
  }).catch(() => undefined);

  // Publish standardized events onto the Automation bus.
  if (status === "COMPLETED") {
    const full = await prisma.workflowSubmission.findUnique({
      where: { id: submissionId },
      include: { template: { select: { category: true, name: true } } },
    });
    if (full) {
      const base = {
        organizationId,
        resourceId: submissionId,
        actorUserId: full.submitterUserId,
        metadata: { category: full.template.category, templateName: full.template.name },
      };
      await publishEvent({ type: "Workflow.Completed", ...base }).catch(() => undefined);
      if (full.template.category === "application") {
        await publishEvent({ type: "Application.Approved", ...base }).catch(() => undefined);
      } else if (full.template.category === "training") {
        await publishEvent({ type: "Training.Completed", ...base }).catch(() => undefined);
      }
    }
  }
  return { status };
}

export async function decide(input: {
  actor: Actor;
  organizationId: string;
  submissionId: string;
  decision: "APPROVE" | "DENY" | "REVISE";
  note?: string;
}): Promise<{ status: string }> {
  const s = await requireSubmission(input.organizationId, input.submissionId);
  if (s.status !== "IN_REVIEW") throw new ValidationError("This submission is not awaiting review");
  const def = s.template.workflow as WorkflowDefinition;
  const stage = getStage(def, s.currentStageId);
  if (!stage) throw new ValidationError("No active stage");

  // Reviewer must be assigned to this stage OR hold the template review role.
  const assignment = await prisma.workflowAssignment.findFirst({
    where: {
      submissionId: s.id,
      stageId: stage.id,
      assigneeMembershipId: input.actor.membershipId,
    },
  });
  const isReviewer =
    canReviewTemplate(input.actor, s.template.reviewRoleKeys) ||
    has(input.actor, input.organizationId, "application:review");
  if (!assignment && !isReviewer) throw new ForbiddenError("You are not a reviewer for this stage");

  // Record the decision (create an assignment row if the reviewer had none).
  if (assignment) {
    await prisma.workflowAssignment.update({
      where: { id: assignment.id },
      data: { decision: input.decision, decisionNote: input.note ?? null, decidedAt: new Date() },
    });
  } else {
    await prisma.workflowAssignment.create({
      data: {
        organizationId: input.organizationId,
        submissionId: s.id,
        stageId: stage.id,
        assigneeMembershipId: input.actor.membershipId,
        assigneeUserId: input.actor.userId,
        decision: input.decision,
        decisionNote: input.note ?? null,
        decidedAt: new Date(),
      },
    });
  }

  const stageAssignments = await prisma.workflowAssignment.findMany({
    where: { submissionId: s.id, stageId: stage.id },
  });
  const decisions = stageAssignments
    .filter((a) => a.decision)
    .map((a) => a.decision as "APPROVE" | "DENY" | "REVISE");
  const outcome = evaluateStage(stage, decisions, stageAssignments.length);

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "application:review",
    resourceType: "workflow_submission",
    resourceId: s.id,
    source: "WEB",
    metadata: { decision: input.decision, stageId: stage.id },
  }).catch(() => undefined);

  if (outcome === "pending") return { status: "IN_REVIEW" };
  return advanceFrom(
    input.organizationId,
    s.id,
    def,
    stage,
    outcome,
    input.actor.userId,
    s.submitterMembershipId,
  );
}

export async function assignReviewer(input: {
  actor: Actor;
  organizationId: string;
  submissionId: string;
  membershipId: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "application:manage");
  const s = await requireSubmission(input.organizationId, input.submissionId);
  if (!s.currentStageId) throw new ValidationError("No active stage to assign");
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  const existing = await prisma.workflowAssignment.findFirst({
    where: { submissionId: s.id, stageId: s.currentStageId, assigneeMembershipId: membership.id },
  });
  if (!existing) {
    await prisma.workflowAssignment.create({
      data: {
        organizationId: input.organizationId,
        submissionId: s.id,
        stageId: s.currentStageId,
        assigneeMembershipId: membership.id,
        assigneeUserId: membership.userId,
      },
    });
  }
  await recordEvent(input.organizationId, s.id, "REVIEWER_ASSIGNED", input.actor.userId, {
    membershipId: membership.id,
    manual: true,
  });
  await createNotification({
    organizationId: input.organizationId,
    userId: membership.userId,
    type: "workflow",
    title: "You were assigned a review",
    linkUrl: "/app/applications",
  }).catch(() => undefined);
}

export async function addComment(input: {
  actor: Actor;
  organizationId: string;
  submissionId: string;
  body: string;
  visibility: CommentVisibility;
}): Promise<void> {
  const s = await requireSubmission(input.organizationId, input.submissionId);
  const isReviewer =
    canReviewTemplate(input.actor, s.template.reviewRoleKeys) ||
    has(input.actor, input.organizationId, "application:review");
  const isSubmitter = s.submitterMembershipId === input.actor.membershipId;
  if (input.visibility === "INTERNAL" && !isReviewer)
    throw new ForbiddenError("Only reviewers can add internal notes");
  if (!isReviewer && !isSubmitter) throw new ForbiddenError("Not permitted to comment");
  if (input.body.trim().length < 1) throw new ValidationError("Comment is empty");
  await prisma.workflowComment.create({
    data: {
      organizationId: input.organizationId,
      submissionId: s.id,
      authorUserId: input.actor.userId,
      body: input.body.trim(),
      visibility: input.visibility,
    },
  });
  await recordEvent(
    input.organizationId,
    s.id,
    input.visibility === "INTERNAL" ? "NOTE_ADDED" : "COMMENT_ADDED",
    input.actor.userId,
  );
}

export type SubmissionDetail = SubmissionView & {
  form: FormSchema;
  workflow: WorkflowDefinition;
  timeline: {
    type: string;
    actorName: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
  comments: { authorName: string; body: string; visibility: string; createdAt: string }[];
  assignments: { name: string; stageId: string; decision: string | null }[];
};

export async function getSubmission(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<SubmissionDetail> {
  const s = await requireSubmission(input.organizationId, input.id);
  const isReviewer =
    canReviewTemplate(input.actor, s.template.reviewRoleKeys) ||
    has(input.actor, input.organizationId, "application:review");
  const isSubmitter = s.submitterMembershipId === input.actor.membershipId;
  if (!isReviewer && !isSubmitter)
    throw new ForbiddenError("Not permitted to view this submission");

  const [events, comments, assignments] = await Promise.all([
    prisma.workflowEvent.findMany({
      where: { submissionId: s.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.workflowComment.findMany({
      where: { submissionId: s.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workflowAssignment.findMany({ where: { submissionId: s.id } }),
  ]);
  const userIds = [
    ...new Set([
      s.submitterUserId,
      ...events.map((e) => e.actorUserId).filter((x): x is string => Boolean(x)),
      ...comments.map((c) => c.authorUserId),
      ...assignments.map((a) => a.assigneeUserId),
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const def = s.template.workflow as WorkflowDefinition;

  // Internal notes are NEVER returned to an applicant-only viewer.
  const visibleComments = comments.filter((c) => isReviewer || c.visibility === "APPLICANT");

  return {
    id: s.id,
    publicId: s.publicId,
    templateId: s.templateId,
    templateName: s.template.name,
    category: s.template.category,
    status: s.status,
    currentStageId: s.currentStageId,
    currentStageName: getStage(def, s.currentStageId)?.name ?? null,
    data: s.data as Record<string, unknown>,
    submitterName: nameById.get(s.submitterUserId) ?? "Member",
    submittedAt: s.submittedAt?.toISOString() ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
    canReview: isReviewer,
    isSubmitter,
    form: s.template.form as FormSchema,
    workflow: def,
    timeline: events.map((e) => ({
      type: e.type,
      actorName: e.actorUserId ? (nameById.get(e.actorUserId) ?? "Member") : null,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata as Record<string, unknown>,
    })),
    comments: visibleComments.map((c) => ({
      authorName: nameById.get(c.authorUserId) ?? "Member",
      body: c.body,
      visibility: c.visibility,
      createdAt: c.createdAt.toISOString(),
    })),
    assignments: assignments.map((a) => ({
      name: nameById.get(a.assigneeUserId) ?? "Member",
      stageId: a.stageId,
      decision: a.decision,
    })),
  };
}

export async function listSubmissions(input: {
  actor: Actor;
  organizationId: string;
  category?: string;
  scope?: "mine" | "assigned" | "all";
}): Promise<SubmissionView[]> {
  const scope = input.scope ?? "mine";
  const where: Record<string, unknown> = {
    organizationId: input.organizationId,
    ...(input.category ? { template: { category: input.category } } : {}),
  };
  if (scope === "mine") where.submitterMembershipId = input.actor.membershipId;
  if (scope === "assigned")
    where.assignments = { some: { assigneeMembershipId: input.actor.membershipId } };
  if (scope === "all") requirePerm(input.actor, input.organizationId, "application:read");

  const rows = await prisma.workflowSubmission.findMany({
    where: where as never,
    include: { template: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.submitterUserId))] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const def = (t: unknown) => t as WorkflowDefinition;
  return rows.map((r) => ({
    id: r.id,
    publicId: r.publicId,
    templateId: r.templateId,
    templateName: r.template.name,
    category: r.template.category,
    status: r.status,
    currentStageId: r.currentStageId,
    currentStageName: getStage(def(r.template.workflow), r.currentStageId)?.name ?? null,
    data: {},
    submitterName: nameById.get(r.submitterUserId) ?? "Member",
    submittedAt: r.submittedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    canReview: canReviewTemplate(input.actor, r.template.reviewRoleKeys),
    isSubmitter: r.submitterMembershipId === input.actor.membershipId,
  }));
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type WorkflowAnalytics = {
  total: number;
  byStatus: Record<string, number>;
  approvalRate: number;
  avgCompletionMinutes: number;
  templateUsage: { name: string; count: number }[];
  reviewerWorkload: { name: string; open: number }[];
};

export async function getWorkflowAnalytics(input: {
  actor: Actor;
  organizationId: string;
}): Promise<WorkflowAnalytics> {
  requirePerm(input.actor, input.organizationId, "application:read");
  const submissions = await prisma.workflowSubmission.findMany({
    where: { organizationId: input.organizationId },
    include: { template: { select: { name: true } } },
  });
  const byStatus: Record<string, number> = {};
  const usage: Record<string, number> = {};
  let completedCount = 0;
  let approvedish = 0;
  let completionMinutes = 0;
  for (const s of submissions) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    usage[s.template.name] = (usage[s.template.name] ?? 0) + 1;
    if (s.status === "COMPLETED") {
      approvedish += 1;
      completedCount += 1;
      if (s.submittedAt && s.completedAt) {
        completionMinutes += Math.max(
          0,
          Math.floor((s.completedAt.getTime() - s.submittedAt.getTime()) / 60000),
        );
      }
    }
    if (s.status === "DENIED") completedCount += 1;
  }
  const openAssignments = await prisma.workflowAssignment.groupBy({
    by: ["assigneeUserId"],
    where: { organizationId: input.organizationId, decision: null },
    _count: { _all: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: openAssignments.map((o) => o.assigneeUserId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    total: submissions.length,
    byStatus,
    approvalRate: completedCount > 0 ? approvedish / completedCount : 0,
    avgCompletionMinutes: approvedish > 0 ? Math.round(completionMinutes / approvedish) : 0,
    templateUsage: Object.entries(usage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    reviewerWorkload: openAssignments
      .map((o) => ({ name: nameById.get(o.assigneeUserId) ?? "Member", open: o._count._all }))
      .sort((a, b) => b.open - a.open),
  };
}

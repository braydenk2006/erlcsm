import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId, ValidationError } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  addComment,
  createDraft,
  decide,
  getSubmission,
  getWorkflowAnalytics,
  listTemplates,
  submitSubmission,
} from "../workflow/service";

const hasDb = Boolean(process.env.DATABASE_URL);

async function addMember(organizationId: string, name: string, roleKey: string) {
  const user = await prisma.user.create({
    data: {
      publicId: createPublicId("usr"),
      name,
      email: `${name}-${Date.now()}@ex.com`,
      emailVerified: true,
    },
  });
  const membership = await prisma.membership.create({
    data: { publicId: createPublicId("mem"), organizationId, userId: user.id, status: "ACTIVE" },
  });
  const role = await prisma.role.findFirst({ where: { organizationId, key: roleKey } });
  if (role)
    await prisma.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
  return { userId: user.id, membershipId: membership.id };
}

describe.skipIf(!hasDb)("workflow platform", () => {
  let orgId = "";
  let owner: Actor;
  let submitter: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "WF Owner",
        email: `wf-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "WF Co", slug: `wf-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
    const staff = await addMember(orgId, "Staffer", "staff");
    submitter = await buildActorForUser(staff.userId, orgId);
  });

  async function templateByCategory(category: string) {
    const templates = await listTemplates({ actor: owner, organizationId: orgId, category });
    return templates[0]!;
  }

  it("validates against the form schema before submitting", async () => {
    const leave = await templateByCategory("leave");
    const { id } = await createDraft({
      actor: submitter,
      organizationId: orgId,
      templateId: leave.id,
    });
    await expect(
      submitSubmission({
        actor: submitter,
        organizationId: orgId,
        submissionId: id,
        data: { reason: "x" },
      }),
    ).rejects.toBeInstanceOf(ValidationError); // missing required start/end/type
  });

  it("runs submit → single-stage approve → completed with a full timeline", async () => {
    const leave = await templateByCategory("leave");
    const { id } = await createDraft({
      actor: submitter,
      organizationId: orgId,
      templateId: leave.id,
    });
    const res = await submitSubmission({
      actor: submitter,
      organizationId: orgId,
      submissionId: id,
      data: { start: "2026-02-01", end: "2026-02-03", type: "vacation", reason: "family time" },
    });
    expect(res.status).toBe("IN_REVIEW");
    const decided = await decide({
      actor: owner,
      organizationId: orgId,
      submissionId: id,
      decision: "APPROVE",
    });
    expect(decided.status).toBe("COMPLETED");
    const detail = await getSubmission({ actor: owner, organizationId: orgId, id });
    const types = detail.timeline.map((t) => t.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "SUBMISSION_SUBMITTED",
        "SUBMISSION_APPROVED",
        "SUBMISSION_COMPLETED",
      ]),
    );
  });

  it("keeps internal notes hidden from the applicant", async () => {
    const general = await templateByCategory("general");
    const { id } = await createDraft({
      actor: submitter,
      organizationId: orgId,
      templateId: general.id,
    });
    await submitSubmission({
      actor: submitter,
      organizationId: orgId,
      submissionId: id,
      data: { subject: "Hi", details: "Please review" },
    });
    await addComment({
      actor: owner,
      organizationId: orgId,
      submissionId: id,
      body: "internal only",
      visibility: "INTERNAL",
    });
    await addComment({
      actor: owner,
      organizationId: orgId,
      submissionId: id,
      body: "visible reply",
      visibility: "APPLICANT",
    });

    const asApplicant = await getSubmission({ actor: submitter, organizationId: orgId, id });
    expect(asApplicant.comments.some((c) => c.body === "internal only")).toBe(false);
    expect(asApplicant.comments.some((c) => c.body === "visible reply")).toBe(true);
    const asReviewer = await getSubmission({ actor: owner, organizationId: orgId, id });
    expect(asReviewer.comments.some((c) => c.body === "internal only")).toBe(true);
  });

  it("runs a multi-stage approval (application: review → interview → completed)", async () => {
    const app = await templateByCategory("application");
    const { id } = await createDraft({
      actor: submitter,
      organizationId: orgId,
      templateId: app.id,
    });
    await submitSubmission({
      actor: submitter,
      organizationId: orgId,
      submissionId: id,
      data: { roblox: "Tester", timezone: "UTC", why: "I really want to help this community grow" },
    });
    const first = await decide({
      actor: owner,
      organizationId: orgId,
      submissionId: id,
      decision: "APPROVE",
    });
    expect(first.status).toBe("IN_REVIEW"); // advanced to interview
    const second = await decide({
      actor: owner,
      organizationId: orgId,
      submissionId: id,
      decision: "APPROVE",
    });
    expect(second.status).toBe("COMPLETED");
  });

  it("auto-completes an AUTO stage (training self-completion)", async () => {
    const training = await templateByCategory("training");
    const { id } = await createDraft({
      actor: submitter,
      organizationId: orgId,
      templateId: training.id,
    });
    const res = await submitSubmission({
      actor: submitter,
      organizationId: orgId,
      submissionId: id,
      data: { lesson_ack: true, q1: "shift", q2: "supervisor" },
    });
    expect(res.status).toBe("COMPLETED");
  });

  it("reports analytics from the shared platform", async () => {
    const analytics = await getWorkflowAnalytics({ actor: owner, organizationId: orgId });
    expect(analytics.total).toBeGreaterThanOrEqual(4);
    expect(analytics.byStatus.COMPLETED).toBeGreaterThanOrEqual(2);
  });
});

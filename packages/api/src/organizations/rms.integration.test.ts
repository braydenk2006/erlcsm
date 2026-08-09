import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  addCaseNarrative,
  applyCustody,
  collectEvidence,
  createCase,
  createPerson,
  createRecord,
  getCase,
  getCustodyChain,
  getRelationships,
  getTimeline,
  link,
  listCases,
  searchRms,
  updateCaseStatus,
} from "../rms/service";
import { askOrdinex } from "../ai/service";

const hasDb = Boolean(process.env.DATABASE_URL);

async function eventCount(org: string, type: string): Promise<number> {
  return prisma.automationEventLog.count({ where: { organizationId: org, type } });
}

describe.skipIf(!hasDb)("enterprise RMS", () => {
  let orgId = "";
  let owner: Actor;
  let caseId = "";
  let evidenceId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "RMS Chief",
        email: `rms-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "RMS Co", slug: `rms-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
  });

  it("creates a case (numbered, timelined, automation event)", async () => {
    const before = await eventCount(orgId, "Case.Created");
    const c = await createCase({
      actor: owner,
      organizationId: orgId,
      title: "Armed Robbery at Bank",
    });
    caseId = c.id;
    expect(c.number).toMatch(/^CASE-\d{4}-\d{6}$/);
    expect(c.status).toBe("OPEN");
    const detail = await getCase({ actor: owner, organizationId: orgId, id: c.id });
    expect(detail.timeline.some((t) => t.type === "created")).toBe(true);
    expect(await eventCount(orgId, "Case.Created")).toBe(before + 1);
    expect(
      (await listCases({ actor: owner, organizationId: orgId })).some((x) => x.id === c.id),
    ).toBe(true);
  });

  it("collects evidence, auto-links it to the case, and emits an event", async () => {
    const before = await eventCount(orgId, "Evidence.Collected");
    const e = await collectEvidence({
      actor: owner,
      organizationId: orgId,
      description: "Handgun recovered at scene",
      caseId,
    });
    evidenceId = e.id;
    expect(e.number).toMatch(/^EVD-\d{4}-\d{6}$/);
    expect(e.status).toBe("COLLECTED");
    expect(await eventCount(orgId, "Evidence.Collected")).toBe(before + 1);
    // Auto-linked to the case (relationship engine, bidirectional).
    const caseRels = await getRelationships({
      actor: owner,
      organizationId: orgId,
      type: "case",
      id: caseId,
    });
    expect(caseRels.some((r) => r.record.type === "evidence" && r.record.id === evidenceId)).toBe(
      true,
    );
    const evRels = await getRelationships({
      actor: owner,
      organizationId: orgId,
      type: "evidence",
      id: evidenceId,
    });
    expect(evRels.some((r) => r.record.type === "case" && r.record.id === caseId)).toBe(true);
    const detail = await getCase({ actor: owner, organizationId: orgId, id: caseId });
    expect(detail.evidence.some((x) => x.id === evidenceId)).toBe(true);
  });

  it("maintains an immutable, valid chain of custody through actions", async () => {
    await applyCustody({ actor: owner, organizationId: orgId, evidenceId, action: "CHECK_OUT" });
    expect(await eventCount(orgId, "Evidence.CheckedOut")).toBeGreaterThanOrEqual(1);
    await applyCustody({ actor: owner, organizationId: orgId, evidenceId, action: "RETURN" });
    expect(await eventCount(orgId, "Evidence.Returned")).toBeGreaterThanOrEqual(1);
    const chain = await getCustodyChain({ actor: owner, organizationId: orgId, evidenceId });
    expect(chain.chain.map((c) => c.action)).toEqual(["COLLECT", "CHECK_OUT", "RETURN"]);
    expect(chain.chain.map((c) => c.sequence)).toEqual([1, 2, 3]);
    expect(chain.integrity.valid).toBe(true);
    // Illegal action is rejected (cannot RETURN when not checked out).
    await expect(
      applyCustody({ actor: owner, organizationId: orgId, evidenceId, action: "RETURN" }),
    ).rejects.toThrow();
    // Custody rows are append-only (there is no update path); still exactly 3.
    expect(await prisma.rmsCustodyEvent.count({ where: { evidenceId } })).toBe(3);
  });

  it("navigates relationships across record types (person → case)", async () => {
    const person = await createPerson({
      actor: owner,
      organizationId: orgId,
      name: "John Q. Suspect",
      aliases: ["JQ"],
    });
    await link({
      actor: owner,
      organizationId: orgId,
      fromType: "person",
      fromId: person.id,
      toType: "case",
      toId: caseId,
      relation: "suspect_in",
    });
    const personRels = await getRelationships({
      actor: owner,
      organizationId: orgId,
      type: "person",
      id: person.id,
    });
    expect(personRels.some((r) => r.record.id === caseId && r.label === "Suspect in")).toBe(true);
    const caseRels = await getRelationships({
      actor: owner,
      organizationId: orgId,
      type: "case",
      id: caseId,
    });
    expect(caseRels.some((r) => r.record.id === person.id && r.direction === "incoming")).toBe(
      true,
    );
  });

  it("runs a permission-scoped global search across record types", async () => {
    const c = await prisma.rmsCase.findUnique({ where: { id: caseId } });
    const byNumber = await searchRms({ actor: owner, organizationId: orgId, query: c!.number });
    expect(byNumber.some((r) => r.type === "case" && r.id === caseId)).toBe(true);
    const byName = await searchRms({ actor: owner, organizationId: orgId, query: "Suspect" });
    expect(byName.some((r) => r.type === "person")).toBe(true);
    expect(await searchRms({ actor: owner, organizationId: orgId, query: "a" })).toHaveLength(0); // min length
  });

  it("creates generic module records (court) and emits Court.Scheduled", async () => {
    const before = await eventCount(orgId, "Court.Scheduled");
    const court = await createRecord({
      actor: owner,
      organizationId: orgId,
      type: "court_case",
      title: "State v. Suspect",
    });
    expect(court.number).toMatch(/^CRT-\d{4}-\d{6}$/);
    expect(await eventCount(orgId, "Court.Scheduled")).toBe(before + 1);
    await link({
      actor: owner,
      organizationId: orgId,
      fromType: "court_case",
      fromId: court.id,
      toType: "case",
      toId: caseId,
      relation: "related_to",
    });
    const rels = await getRelationships({
      actor: owner,
      organizationId: orgId,
      type: "court_case",
      id: court.id,
    });
    expect(rels.some((r) => r.record.id === caseId)).toBe(true);
  });

  it("enforces case status transitions + emits Case.Closed", async () => {
    await addCaseNarrative({
      actor: owner,
      organizationId: orgId,
      id: caseId,
      text: "Suspect apprehended.",
    });
    const before = await eventCount(orgId, "Case.Closed");
    await updateCaseStatus({
      actor: owner,
      organizationId: orgId,
      id: caseId,
      status: "AWAITING_COURT",
    });
    await updateCaseStatus({ actor: owner, organizationId: orgId, id: caseId, status: "CLOSED" });
    expect(await eventCount(orgId, "Case.Closed")).toBe(before + 1);
    await updateCaseStatus({ actor: owner, organizationId: orgId, id: caseId, status: "ARCHIVED" });
    // Archived is terminal.
    await expect(
      updateCaseStatus({ actor: owner, organizationId: orgId, id: caseId, status: "OPEN" }),
    ).rejects.toThrow();
    const timeline = await getTimeline({
      actor: owner,
      organizationId: orgId,
      type: "case",
      id: caseId,
    });
    expect(timeline.some((t) => t.type === "closed")).toBe(true);
    expect(timeline.some((t) => t.type === "narrative_added")).toBe(true);
  });

  it("AI cites operational records without fabricating", async () => {
    const c = await prisma.rmsCase.findUnique({ where: { id: caseId } });
    const { answer } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: `Find case ${c!.number}`,
    });
    expect(answer.citations.some((cit) => cit.kind === "record")).toBe(true);
    expect(answer.text).toContain(c!.number);
  });

  it("isolates tenants — RMS records + search never cross organizations", async () => {
    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other",
        email: `rms-o-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other RMS", slug: `rms-o-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    // Cross-tenant case access is a not-found.
    await expect(
      getCase({ actor: otherActor, organizationId: otherOrg.id, id: caseId }),
    ).rejects.toThrow();
    // Search in the other org never returns this org's case.
    const c = await prisma.rmsCase.findUnique({ where: { id: caseId } });
    expect(
      await searchRms({ actor: otherActor, organizationId: otherOrg.id, query: c!.number }),
    ).toHaveLength(0);
  });
});

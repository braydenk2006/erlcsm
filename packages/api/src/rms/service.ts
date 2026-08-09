import { prisma } from "@commandry/database";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import {
  canApplyCustodyAction,
  canTransitionCase,
  formatRecordNumber,
  isCaseOpen,
  mergeTimeline,
  recordType,
  relationLabel,
  statusAfterCustodyAction,
  validateCustodyChain,
  type CaseStatus,
  type CustodyAction,
  type CustodyEvent,
  type TimelineEntry,
} from "@commandry/rms";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { publishEvent } from "../automation/service";

function can(actor: Actor, organizationId: string, action: string): boolean {
  return authorize({ actor, organizationId, action: action as Action }).allowed;
}
function requireManageType(actor: Actor, organizationId: string, type: string): void {
  const def = recordType(type);
  if (!def) throw new ValidationError("Unknown record type");
  if (!can(actor, organizationId, def.managePermission)) throw new ForbiddenError("Not permitted");
}
function requireViewType(actor: Actor, organizationId: string, type: string): void {
  const def = recordType(type);
  if (!def) throw new ValidationError("Unknown record type");
  if (!can(actor, organizationId, def.viewPermission)) throw new ForbiddenError("Not permitted");
}
function canViewType(actor: Actor, organizationId: string, type: string): boolean {
  const def = recordType(type);
  return def ? can(actor, organizationId, def.viewPermission) : false;
}

async function nextNumber(organizationId: string, prefix: string): Promise<string> {
  const seq = await prisma.rmsSequence.upsert({
    where: { organizationId_key: { organizationId, key: prefix } },
    create: { organizationId, key: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatRecordNumber(prefix, seq.value);
}

async function addTimeline(
  organizationId: string,
  recordTypeName: string,
  recordId: string,
  entry: {
    type: string;
    title: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  },
): Promise<void> {
  await prisma.rmsTimelineEvent.create({
    data: {
      organizationId,
      recordType: recordTypeName,
      recordId,
      type: entry.type,
      title: entry.title,
      actorUserId: entry.actorUserId ?? null,
      metadata: (entry.metadata ?? {}) as object,
      occurredAt: entry.occurredAt ?? new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Record reference resolution (used by relationships + search)
// ---------------------------------------------------------------------------

export type RecordRef = { type: string; id: string; number: string; title: string; href: string };

async function resolveRef(
  organizationId: string,
  type: string,
  id: string,
): Promise<RecordRef | null> {
  const href = `/app/rms?record=${type}:${id}`;
  switch (type) {
    case "case": {
      const r = await prisma.rmsCase.findFirst({
        where: { id, organizationId },
        select: { number: true, title: true },
      });
      return r ? { type, id, number: r.number, title: r.title, href } : null;
    }
    case "evidence": {
      const r = await prisma.rmsEvidence.findFirst({
        where: { id, organizationId },
        select: { number: true, description: true },
      });
      return r ? { type, id, number: r.number, title: r.description || "Evidence", href } : null;
    }
    case "person": {
      const r = await prisma.rmsPerson.findFirst({
        where: { id, organizationId },
        select: { number: true, name: true },
      });
      return r ? { type, id, number: r.number, title: r.name, href } : null;
    }
    case "vehicle": {
      const r = await prisma.rmsVehicle.findFirst({
        where: { id, organizationId },
        select: { number: true, plate: true },
      });
      return r ? { type, id, number: r.number, title: r.plate, href } : null;
    }
    case "property": {
      const r = await prisma.rmsProperty.findFirst({
        where: { id, organizationId },
        select: { number: true, description: true },
      });
      return r ? { type, id, number: r.number, title: r.description || "Property", href } : null;
    }
    default: {
      const r = await prisma.rmsRecord.findFirst({
        where: { id, organizationId, type },
        select: { number: true, title: true },
      });
      return r ? { type, id, number: r.number, title: r.title, href } : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Relationship Engine
// ---------------------------------------------------------------------------

export async function link(input: {
  actor: Actor;
  organizationId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
}): Promise<void> {
  requireManageType(input.actor, input.organizationId, input.fromType);
  requireViewType(input.actor, input.organizationId, input.toType);
  const [fromRef, toRef] = await Promise.all([
    resolveRef(input.organizationId, input.fromType, input.fromId),
    resolveRef(input.organizationId, input.toType, input.toId),
  ]);
  if (!fromRef || !toRef) throw new NotFoundError("Record not found");
  await prisma.rmsLink
    .create({
      data: {
        organizationId: input.organizationId,
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        relation: input.relation,
        createdByUserId: input.actor.userId,
      },
    })
    .catch(() => undefined); // idempotent on unique
  await addTimeline(input.organizationId, input.fromType, input.fromId, {
    type: "linked",
    title: `Linked to ${toRef.number} (${relationLabel(input.relation)})`,
    actorUserId: input.actor.userId,
  });
  await addTimeline(input.organizationId, input.toType, input.toId, {
    type: "linked",
    title: `Linked from ${fromRef.number} (${relationLabel(input.relation, true)})`,
    actorUserId: input.actor.userId,
  });
}

export async function unlink(input: {
  actor: Actor;
  organizationId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
}): Promise<void> {
  requireManageType(input.actor, input.organizationId, input.fromType);
  await prisma.rmsLink.deleteMany({
    where: {
      organizationId: input.organizationId,
      fromType: input.fromType,
      fromId: input.fromId,
      toType: input.toType,
      toId: input.toId,
      relation: input.relation,
    },
  });
}

export type Relationship = {
  relation: string;
  label: string;
  direction: "outgoing" | "incoming";
  record: RecordRef;
};

export async function getRelationships(input: {
  actor: Actor;
  organizationId: string;
  type: string;
  id: string;
}): Promise<Relationship[]> {
  requireViewType(input.actor, input.organizationId, input.type);
  const links = await prisma.rmsLink.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        { fromType: input.type, fromId: input.id },
        { toType: input.type, toId: input.id },
      ],
    },
    take: 200,
  });
  const out: Relationship[] = [];
  for (const l of links) {
    const outgoing = l.fromType === input.type && l.fromId === input.id;
    const otherType = outgoing ? l.toType : l.fromType;
    const otherId = outgoing ? l.toId : l.fromId;
    if (!canViewType(input.actor, input.organizationId, otherType)) continue; // permission-aware navigation
    const ref = await resolveRef(input.organizationId, otherType, otherId);
    if (!ref) continue;
    out.push({
      relation: l.relation,
      label: relationLabel(l.relation, !outgoing),
      direction: outgoing ? "outgoing" : "incoming",
      record: ref,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Timeline Engine
// ---------------------------------------------------------------------------

export async function getTimeline(input: {
  actor: Actor;
  organizationId: string;
  type: string;
  id: string;
}): Promise<TimelineEntry[]> {
  requireViewType(input.actor, input.organizationId, input.type);
  const events = await prisma.rmsTimelineEvent.findMany({
    where: { organizationId: input.organizationId, recordType: input.type, recordId: input.id },
    take: 500,
  });
  const entries: TimelineEntry[] = events.map((e) => ({
    type: e.type,
    title: e.title,
    actorUserId: e.actorUserId,
    occurredAt: e.occurredAt,
    metadata: e.metadata as Record<string, unknown>,
  }));
  return mergeTimeline(entries);
}

// ---------------------------------------------------------------------------
// Case Management
// ---------------------------------------------------------------------------

export type CaseView = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  narrative: string;
  createdAt: string;
  updatedAt: string;
};

function caseView(c: {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  narrative: string;
  createdAt: Date;
  updatedAt: Date;
}): CaseView {
  return {
    id: c.id,
    number: c.number,
    title: c.title,
    status: c.status,
    priority: c.priority,
    narrative: c.narrative,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function createCase(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  narrative?: string;
  priority?: string;
}): Promise<CaseView> {
  if (!can(input.actor, input.organizationId, "cases.create"))
    throw new ForbiddenError("Not permitted");
  if (input.title.trim().length < 2) throw new ValidationError("Title too short");
  const number = await nextNumber(input.organizationId, "CASE");
  const c = await prisma.rmsCase.create({
    data: {
      publicId: createPublicId("case"),
      organizationId: input.organizationId,
      number,
      title: input.title.trim(),
      narrative: input.narrative ?? "",
      priority: input.priority ?? "normal",
      createdByUserId: input.actor.userId,
    },
  });
  await addTimeline(input.organizationId, "case", c.id, {
    type: "created",
    title: `Case ${number} created`,
    actorUserId: input.actor.userId,
  });
  await publishEvent({
    type: "Case.Created",
    organizationId: input.organizationId,
    resourceId: c.id,
    actorUserId: input.actor.userId,
    metadata: { number, title: c.title },
  }).catch(() => undefined);
  return caseView(c);
}

export async function listCases(input: {
  actor: Actor;
  organizationId: string;
  status?: string;
  query?: string;
}): Promise<CaseView[]> {
  if (!can(input.actor, input.organizationId, "cases.view"))
    throw new ForbiddenError("Not permitted");
  const rows = await prisma.rmsCase.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.query
        ? {
            OR: [
              { number: { contains: input.query, mode: "insensitive" } },
              { title: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(caseView);
}

export async function getCase(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<{
  case: CaseView;
  timeline: TimelineEntry[];
  relationships: Relationship[];
  evidence: EvidenceView[];
}> {
  if (!can(input.actor, input.organizationId, "cases.view"))
    throw new ForbiddenError("Not permitted");
  const c = await prisma.rmsCase.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!c) throw new NotFoundError("Case not found");
  const [timeline, relationships, evidenceRows] = await Promise.all([
    getTimeline({
      actor: input.actor,
      organizationId: input.organizationId,
      type: "case",
      id: c.id,
    }),
    getRelationships({
      actor: input.actor,
      organizationId: input.organizationId,
      type: "case",
      id: c.id,
    }),
    can(input.actor, input.organizationId, "evidence.manage")
      ? prisma.rmsEvidence.findMany({
          where: { organizationId: input.organizationId, caseId: c.id },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  return { case: caseView(c), timeline, relationships, evidence: evidenceRows.map(evidenceView) };
}

export async function updateCaseStatus(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  status: CaseStatus;
}): Promise<CaseView> {
  const c = await prisma.rmsCase.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!c) throw new NotFoundError("Case not found");
  const perm = input.status === "ARCHIVED" ? "cases.archive" : "cases.edit";
  if (!can(input.actor, input.organizationId, perm)) throw new ForbiddenError("Not permitted");
  if (!canTransitionCase(c.status as CaseStatus, input.status))
    throw new ValidationError(`Cannot move case from ${c.status} to ${input.status}`);
  const closing = input.status === "CLOSED";
  const updated = await prisma.rmsCase.update({
    where: { id: c.id },
    data: { status: input.status, ...(closing ? { closedAt: new Date() } : {}) },
  });
  await addTimeline(input.organizationId, "case", c.id, {
    type: closing ? "closed" : "status_changed",
    title: `Status → ${input.status}`,
    actorUserId: input.actor.userId,
  });
  if (closing)
    await publishEvent({
      type: "Case.Closed",
      organizationId: input.organizationId,
      resourceId: c.id,
      actorUserId: input.actor.userId,
      metadata: { number: c.number },
    }).catch(() => undefined);
  return caseView(updated);
}

export async function addCaseNarrative(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  text: string;
}): Promise<void> {
  if (!can(input.actor, input.organizationId, "cases.edit"))
    throw new ForbiddenError("Not permitted");
  const c = await prisma.rmsCase.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!c) throw new NotFoundError("Case not found");
  const stamp = new Date().toISOString();
  await prisma.rmsCase.update({
    where: { id: c.id },
    data: { narrative: `${c.narrative}${c.narrative ? "\n\n" : ""}[${stamp}] ${input.text}` },
  });
  await addTimeline(input.organizationId, "case", c.id, {
    type: "narrative_added",
    title: "Narrative entry added",
    actorUserId: input.actor.userId,
  });
}

// ---------------------------------------------------------------------------
// Evidence Management + immutable chain of custody
// ---------------------------------------------------------------------------

export type EvidenceView = {
  id: string;
  number: string;
  type: string;
  description: string;
  status: string;
  storageLocation: string | null;
  caseId: string | null;
  collectedAt: string;
};

function evidenceView(e: {
  id: string;
  number: string;
  type: string;
  description: string;
  status: string;
  storageLocation: string | null;
  caseId: string | null;
  collectedAt: Date;
}): EvidenceView {
  return {
    id: e.id,
    number: e.number,
    type: e.type,
    description: e.description,
    status: e.status,
    storageLocation: e.storageLocation,
    caseId: e.caseId,
    collectedAt: e.collectedAt.toISOString(),
  };
}

export async function collectEvidence(input: {
  actor: Actor;
  organizationId: string;
  description: string;
  type?: string;
  storageLocation?: string;
  location?: string;
  caseId?: string;
}): Promise<EvidenceView> {
  if (!can(input.actor, input.organizationId, "evidence.manage"))
    throw new ForbiddenError("Not permitted");
  const number = await nextNumber(input.organizationId, "EVD");
  const e = await prisma.rmsEvidence.create({
    data: {
      publicId: createPublicId("evd"),
      organizationId: input.organizationId,
      number,
      description: input.description,
      type: input.type ?? "item",
      status: "COLLECTED",
      storageLocation: input.storageLocation ?? null,
      location: input.location ?? null,
      collectedByUserId: input.actor.userId,
      caseId: input.caseId ?? null,
    },
  });
  await prisma.rmsCustodyEvent.create({
    data: {
      organizationId: input.organizationId,
      evidenceId: e.id,
      sequence: 1,
      action: "COLLECT",
      toUserId: input.actor.userId,
      condition: "as collected",
    },
  });
  await addTimeline(input.organizationId, "evidence", e.id, {
    type: "evidence_collected",
    title: `Evidence ${number} collected`,
    actorUserId: input.actor.userId,
  });
  if (input.caseId) {
    await link({
      actor: input.actor,
      organizationId: input.organizationId,
      fromType: "evidence",
      fromId: e.id,
      toType: "case",
      toId: input.caseId,
      relation: "evidence_for",
    }).catch(() => undefined);
  }
  await publishEvent({
    type: "Evidence.Collected",
    organizationId: input.organizationId,
    resourceId: e.id,
    actorUserId: input.actor.userId,
    metadata: { number, type: e.type },
  }).catch(() => undefined);
  return evidenceView(e);
}

export async function applyCustody(input: {
  actor: Actor;
  organizationId: string;
  evidenceId: string;
  action: CustodyAction;
  toUserId?: string;
  reason?: string;
  condition?: string;
  signature?: string;
  notes?: string;
}): Promise<EvidenceView> {
  if (!can(input.actor, input.organizationId, "evidence.manage"))
    throw new ForbiddenError("Not permitted");
  const e = await prisma.rmsEvidence.findFirst({
    where: { id: input.evidenceId, organizationId: input.organizationId },
  });
  if (!e) throw new NotFoundError("Evidence not found");
  if (!canApplyCustodyAction(e.status as never, input.action))
    throw new ValidationError(`Cannot ${input.action} evidence in status ${e.status}`);
  const last = await prisma.rmsCustodyEvent.findFirst({
    where: { evidenceId: e.id },
    orderBy: { sequence: "desc" },
  });
  const sequence = (last?.sequence ?? 0) + 1;
  const fromUserId = last?.toUserId ?? null;
  await prisma.rmsCustodyEvent.create({
    data: {
      organizationId: input.organizationId,
      evidenceId: e.id,
      sequence,
      action: input.action,
      fromUserId,
      toUserId: input.toUserId ?? (input.action === "RETURN" ? fromUserId : input.actor.userId),
      reason: input.reason ?? null,
      condition: input.condition ?? null,
      signature: input.signature ?? null,
      notes: input.notes ?? null,
    },
  });
  const updated = await prisma.rmsEvidence.update({
    where: { id: e.id },
    data: {
      status: statusAfterCustodyAction(input.action),
      ...(input.action === "TRANSFER" && input.reason ? { storageLocation: input.reason } : {}),
    },
  });
  await addTimeline(input.organizationId, "evidence", e.id, {
    type: "custody_transfer",
    title: `Custody: ${input.action}`,
    actorUserId: input.actor.userId,
    metadata: { sequence },
  });
  if (input.action === "CHECK_OUT")
    await publishEvent({
      type: "Evidence.CheckedOut",
      organizationId: input.organizationId,
      resourceId: e.id,
      actorUserId: input.actor.userId,
      metadata: { number: e.number },
    }).catch(() => undefined);
  if (input.action === "RETURN")
    await publishEvent({
      type: "Evidence.Returned",
      organizationId: input.organizationId,
      resourceId: e.id,
      actorUserId: input.actor.userId,
      metadata: { number: e.number },
    }).catch(() => undefined);
  return evidenceView(updated);
}

export async function getCustodyChain(input: {
  actor: Actor;
  organizationId: string;
  evidenceId: string;
}): Promise<{
  evidence: EvidenceView;
  chain: CustodyEvent[];
  integrity: { valid: boolean; issues: string[] };
}> {
  if (!can(input.actor, input.organizationId, "evidence.manage"))
    throw new ForbiddenError("Not permitted");
  const e = await prisma.rmsEvidence.findFirst({
    where: { id: input.evidenceId, organizationId: input.organizationId },
  });
  if (!e) throw new NotFoundError("Evidence not found");
  const events = await prisma.rmsCustodyEvent.findMany({
    where: { evidenceId: e.id },
    orderBy: { sequence: "asc" },
  });
  const chain: CustodyEvent[] = events.map((c) => ({
    sequence: c.sequence,
    action: c.action as CustodyAction,
    fromUserId: c.fromUserId,
    toUserId: c.toUserId,
    reason: c.reason,
    condition: c.condition,
    signature: c.signature,
    at: c.createdAt,
  }));
  return { evidence: evidenceView(e), chain, integrity: validateCustodyChain(chain) };
}

// ---------------------------------------------------------------------------
// Person / Vehicle / Property + generic records
// ---------------------------------------------------------------------------

export async function createPerson(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  aliases?: string[];
  dob?: string;
  notes?: string;
  flags?: Record<string, unknown>;
}): Promise<RecordRef> {
  requireManageType(input.actor, input.organizationId, "person");
  const number = await nextNumber(input.organizationId, "PER");
  const p = await prisma.rmsPerson.create({
    data: {
      publicId: createPublicId("per"),
      organizationId: input.organizationId,
      number,
      name: input.name,
      aliases: input.aliases ?? [],
      dob: input.dob ?? null,
      notes: input.notes ?? "",
      flags: (input.flags ?? {}) as object,
    },
  });
  await addTimeline(input.organizationId, "person", p.id, {
    type: "created",
    title: `Person ${number} created`,
    actorUserId: input.actor.userId,
  });
  return (await resolveRef(input.organizationId, "person", p.id))!;
}

export async function createVehicle(input: {
  actor: Actor;
  organizationId: string;
  plate: string;
  make?: string;
  model?: string;
  color?: string;
  ownerPersonId?: string;
}): Promise<RecordRef> {
  requireManageType(input.actor, input.organizationId, "vehicle");
  const number = await nextNumber(input.organizationId, "VEH");
  const v = await prisma.rmsVehicle.create({
    data: {
      publicId: createPublicId("veh"),
      organizationId: input.organizationId,
      number,
      plate: input.plate,
      make: input.make ?? null,
      model: input.model ?? null,
      color: input.color ?? null,
      ownerPersonId: input.ownerPersonId ?? null,
    },
  });
  await addTimeline(input.organizationId, "vehicle", v.id, {
    type: "created",
    title: `Vehicle ${number} created`,
    actorUserId: input.actor.userId,
  });
  if (input.ownerPersonId)
    await link({
      actor: input.actor,
      organizationId: input.organizationId,
      fromType: "vehicle",
      fromId: v.id,
      toType: "person",
      toId: input.ownerPersonId,
      relation: "registered_to",
    }).catch(() => undefined);
  return (await resolveRef(input.organizationId, "vehicle", v.id))!;
}

export async function createProperty(input: {
  actor: Actor;
  organizationId: string;
  description: string;
  type?: string;
  storageLocation?: string;
  ownerPersonId?: string;
}): Promise<RecordRef> {
  requireManageType(input.actor, input.organizationId, "property");
  const number = await nextNumber(input.organizationId, "PROP");
  const p = await prisma.rmsProperty.create({
    data: {
      publicId: createPublicId("prop"),
      organizationId: input.organizationId,
      number,
      description: input.description,
      type: input.type ?? "item",
      storageLocation: input.storageLocation ?? null,
      ownerPersonId: input.ownerPersonId ?? null,
    },
  });
  await addTimeline(input.organizationId, "property", p.id, {
    type: "created",
    title: `Property ${number} created`,
    actorUserId: input.actor.userId,
  });
  return (await resolveRef(input.organizationId, "property", p.id))!;
}

export type GenericRecordView = {
  id: string;
  type: string;
  number: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export async function createRecord(input: {
  actor: Actor;
  organizationId: string;
  type: string;
  title: string;
  status?: string;
  data?: Record<string, unknown>;
}): Promise<GenericRecordView> {
  const def = recordType(input.type);
  if (!def || !def.generic) throw new ValidationError("Unknown generic record type");
  requireManageType(input.actor, input.organizationId, input.type);
  if (input.title.trim().length < 2) throw new ValidationError("Title too short");
  const number = await nextNumber(input.organizationId, def.numberPrefix);
  const r = await prisma.rmsRecord.create({
    data: {
      publicId: createPublicId("rms"),
      organizationId: input.organizationId,
      type: input.type,
      number,
      title: input.title.trim(),
      status: input.status ?? "open",
      data: (input.data ?? {}) as object,
      createdByUserId: input.actor.userId,
    },
  });
  await addTimeline(input.organizationId, input.type, r.id, {
    type: "created",
    title: `${def.label} ${number} created`,
    actorUserId: input.actor.userId,
  });
  if (input.type === "court_case")
    await publishEvent({
      type: "Court.Scheduled",
      organizationId: input.organizationId,
      resourceId: r.id,
      actorUserId: input.actor.userId,
      metadata: { number },
    }).catch(() => undefined);
  return {
    id: r.id,
    type: r.type,
    number: r.number,
    title: r.title,
    status: r.status,
    data: r.data as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRecords(input: {
  actor: Actor;
  organizationId: string;
  type: string;
  status?: string;
}): Promise<GenericRecordView[]> {
  requireViewType(input.actor, input.organizationId, input.type);
  const rows = await prisma.rmsRecord.findMany({
    where: {
      organizationId: input.organizationId,
      type: input.type,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    number: r.number,
    title: r.title,
    status: r.status,
    data: r.data as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Global Search (permission + tenant scoped)
// ---------------------------------------------------------------------------

export type SearchHit = {
  type: string;
  id: string;
  number: string;
  title: string;
  href: string;
  snippet: string;
};

export async function searchRms(input: {
  actor: Actor;
  organizationId: string;
  query: string;
}): Promise<SearchHit[]> {
  if (!can(input.actor, input.organizationId, "rms.view"))
    throw new ForbiddenError("Not permitted");
  const q = input.query.trim();
  if (q.length < 2) return [];
  const org = input.organizationId;
  // Token-aware matching: a natural-language question ("Find case CASE-…") still
  // matches the record number/name token. Tokens of length >= 3 only.
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
  const terms = tokens.length > 0 ? tokens : [q];
  const orContains = (fields: string[]) =>
    terms.flatMap((t) =>
      fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" as const } })),
    );
  const hits: SearchHit[] = [];

  if (canViewType(input.actor, org, "case")) {
    const rows = await prisma.rmsCase.findMany({
      where: { organizationId: org, OR: orContains(["number", "title", "narrative"]) },
      take: 10,
    });
    for (const r of rows)
      hits.push({
        type: "case",
        id: r.id,
        number: r.number,
        title: r.title,
        href: `/app/rms?record=case:${r.id}`,
        snippet: r.status,
      });
  }
  if (canViewType(input.actor, org, "evidence")) {
    const rows = await prisma.rmsEvidence.findMany({
      where: { organizationId: org, OR: orContains(["number", "description"]) },
      take: 10,
    });
    for (const r of rows)
      hits.push({
        type: "evidence",
        id: r.id,
        number: r.number,
        title: r.description || "Evidence",
        href: `/app/rms?record=evidence:${r.id}`,
        snippet: r.status,
      });
  }
  if (canViewType(input.actor, org, "person")) {
    const rows = await prisma.rmsPerson.findMany({
      where: {
        organizationId: org,
        OR: [...orContains(["number", "name"]), ...terms.map((t) => ({ aliases: { has: t } }))],
      },
      take: 10,
    });
    for (const r of rows)
      hits.push({
        type: "person",
        id: r.id,
        number: r.number,
        title: r.name,
        href: `/app/rms?record=person:${r.id}`,
        snippet: "person",
      });
  }
  if (canViewType(input.actor, org, "vehicle")) {
    const rows = await prisma.rmsVehicle.findMany({
      where: { organizationId: org, OR: orContains(["number", "plate"]) },
      take: 10,
    });
    for (const r of rows)
      hits.push({
        type: "vehicle",
        id: r.id,
        number: r.number,
        title: r.plate,
        href: `/app/rms?record=vehicle:${r.id}`,
        snippet: [r.make, r.model].filter(Boolean).join(" "),
      });
  }
  if (canViewType(input.actor, org, "property")) {
    const rows = await prisma.rmsProperty.findMany({
      where: { organizationId: org, OR: orContains(["number", "description"]) },
      take: 10,
    });
    for (const r of rows)
      hits.push({
        type: "property",
        id: r.id,
        number: r.number,
        title: r.description || "Property",
        href: `/app/rms?record=property:${r.id}`,
        snippet: r.status,
      });
  }
  // Generic records — only search types the actor can view.
  const genericRows = await prisma.rmsRecord.findMany({
    where: { organizationId: org, OR: orContains(["number", "title"]) },
    take: 40,
  });
  for (const r of genericRows) {
    if (!canViewType(input.actor, org, r.type)) continue;
    hits.push({
      type: r.type,
      id: r.id,
      number: r.number,
      title: r.title,
      href: `/app/rms?record=${r.type}:${r.id}`,
      snippet: r.status,
    });
  }
  return hits.slice(0, 40);
}

// ---------------------------------------------------------------------------
// RMS metrics (feed the Command Center + Insights)
// ---------------------------------------------------------------------------

export type RmsMetrics = {
  openCases: number;
  evidenceAwaitingReview: number;
  courtBacklog: number;
  jailPopulation: number;
  internalAffairsCases: number;
  fleetTotal: number;
  avgInvestigationDays: number | null;
};

export async function getRmsMetrics(input: {
  actor: Actor;
  organizationId: string;
}): Promise<RmsMetrics> {
  if (!can(input.actor, input.organizationId, "rms.view"))
    throw new ForbiddenError("Not permitted");
  const org = input.organizationId;
  const openStates = [
    "OPEN",
    "ACTIVE",
    "PENDING",
    "AWAITING_EVIDENCE",
    "AWAITING_REVIEW",
    "AWAITING_COURT",
  ];
  const [
    openCases,
    evidenceAwaitingReview,
    courtBacklog,
    jailPopulation,
    iaCases,
    fleetTotal,
    closedCases,
  ] = await Promise.all([
    prisma.rmsCase.count({ where: { organizationId: org, status: { in: openStates } } }),
    prisma.rmsEvidence.count({
      where: { organizationId: org, status: { in: ["COLLECTED", "IN_STORAGE"] } },
    }),
    prisma.rmsRecord.count({
      where: {
        organizationId: org,
        type: "court_case",
        status: { notIn: ["closed", "disposed", "archived"] },
      },
    }),
    prisma.rmsRecord.count({
      where: {
        organizationId: org,
        type: "jail_booking",
        status: { notIn: ["released", "closed"] },
      },
    }),
    prisma.rmsRecord.count({
      where: {
        organizationId: org,
        type: "ia_complaint",
        status: { notIn: ["closed", "resolved"] },
      },
    }),
    prisma.rmsRecord.count({ where: { organizationId: org, type: "fleet_vehicle" } }),
    prisma.rmsCase.findMany({
      where: { organizationId: org, status: "CLOSED", closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 200,
    }),
  ]);
  let avgInvestigationDays: number | null = null;
  if (closedCases.length > 0) {
    const totalDays = closedCases.reduce(
      (s, c) => s + (c.closedAt!.getTime() - c.createdAt.getTime()) / 86_400_000,
      0,
    );
    avgInvestigationDays = Math.round((totalDays / closedCases.length) * 10) / 10;
  }
  return {
    openCases,
    evidenceAwaitingReview,
    courtBacklog,
    jailPopulation,
    internalAffairsCases: iaCases,
    fleetTotal,
    avgInvestigationDays,
  };
}

export { isCaseOpen };

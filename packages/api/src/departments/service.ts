import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
  createPublicId,
} from "@commandry/shared";
import { computeUsage, getOrganizationManifest } from "../subscriptions/service";

export type DepartmentView = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  description: string | null;
  accentColor: string | null;
  isActive: boolean;
  memberCount: number;
  leaders: { membershipId: string; name: string }[];
};

function ensure(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function listDepartments(input: {
  actor: Actor;
  organizationId: string;
  includeArchived?: boolean;
}): Promise<DepartmentView[]> {
  ensure(input.actor, input.organizationId, "department:read");
  const departments = await prisma.department.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.includeArchived ? {} : { deletedAt: null }),
    },
    include: {
      members: { where: { isLeader: true }, include: { membership: { include: { user: true } } } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
  return departments.map((d) => ({
    id: d.id,
    publicId: d.publicId,
    name: d.name,
    slug: d.slug,
    description: d.description,
    accentColor: d.accentColor,
    isActive: d.isActive && d.deletedAt === null,
    memberCount: d._count.members,
    leaders: d.members.map((m) => ({ membershipId: m.membershipId, name: m.membership.user.name })),
  }));
}

export async function createDepartment(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  description?: string;
  accentColor?: string;
}): Promise<DepartmentView> {
  ensure(input.actor, input.organizationId, "department:manage");
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Department name is too short");

  // Entitlement limit: departments.max.
  const manifest = await getOrganizationManifest(input.organizationId);
  const usage = await computeUsage(input.organizationId, "departments.max");
  if (usage + 1 > manifest.getLimit("departments.max")) {
    throw new LimitExceededError("departments.max", manifest.getLimit("departments.max"));
  }

  const slug = slugify(name) || `dept-${Date.now()}`;
  const existing = await prisma.department.findFirst({
    where: { organizationId: input.organizationId, slug },
  });
  if (existing) throw new ConflictError("A department with a similar name already exists");

  const department = await prisma.department.create({
    data: {
      publicId: createPublicId("dept"),
      organizationId: input.organizationId,
      name,
      slug,
      description: input.description?.trim() || null,
      accentColor: input.accentColor ?? null,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "department:manage",
    resourceType: "department",
    resourceId: department.id,
    source: "WEB",
    metadata: { action: "create", name },
  }).catch(() => undefined);
  const [view] = await listDepartments({
    actor: input.actor,
    organizationId: input.organizationId,
    includeArchived: true,
  }).then((all) => all.filter((d) => d.id === department.id));
  return view!;
}

async function requireDepartment(organizationId: string, departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
  });
  if (!department) throw new NotFoundError("Department not found");
  return department;
}

export async function updateDepartment(input: {
  actor: Actor;
  organizationId: string;
  departmentId: string;
  name?: string;
  description?: string | null;
  accentColor?: string | null;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "department:manage");
  const department = await requireDepartment(input.organizationId, input.departmentId);
  await prisma.department.update({
    where: { id: department.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.accentColor !== undefined ? { accentColor: input.accentColor } : {}),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "department:manage",
    resourceType: "department",
    resourceId: department.id,
    source: "WEB",
    metadata: { action: "update" },
  }).catch(() => undefined);
}

export async function setDepartmentArchived(input: {
  actor: Actor;
  organizationId: string;
  departmentId: string;
  archived: boolean;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "department:manage");
  const department = await requireDepartment(input.organizationId, input.departmentId);
  await prisma.department.update({
    where: { id: department.id },
    data: { deletedAt: input.archived ? new Date() : null, isActive: !input.archived },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "department:manage",
    resourceType: "department",
    resourceId: department.id,
    source: "WEB",
    metadata: { action: input.archived ? "archive" : "restore" },
  }).catch(() => undefined);
}

export async function setDepartmentLeader(input: {
  actor: Actor;
  organizationId: string;
  departmentId: string;
  membershipId: string;
  isLeader: boolean;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "department:manage_members");
  const department = await requireDepartment(input.organizationId, input.departmentId);
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  await prisma.departmentMember.upsert({
    where: {
      departmentId_membershipId: { departmentId: department.id, membershipId: membership.id },
    },
    create: { departmentId: department.id, membershipId: membership.id, isLeader: input.isLeader },
    update: { isLeader: input.isLeader },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "department:manage_members",
    resourceType: "department",
    resourceId: department.id,
    source: "WEB",
    metadata: { membershipId: membership.id, isLeader: input.isLeader },
  }).catch(() => undefined);
}

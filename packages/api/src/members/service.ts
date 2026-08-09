import { createHash, randomBytes } from "node:crypto";
import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";

export type MemberView = {
  membershipId: string;
  publicId: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  title: string | null;
  joinedAt: Date;
  roles: { id: string; key: string; name: string }[];
  departments: { id: string; name: string; isLeader: boolean }[];
};

export type InvitationView = {
  id: string;
  publicId: string;
  email: string;
  roleKey: string;
  status: string;
  invitedByName: string;
  expiresAt: Date;
  createdAt: Date;
};

function ensure(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function listMembers(input: {
  actor: Actor;
  organizationId: string;
  query?: string;
  status?: string;
  departmentId?: string;
}): Promise<MemberView[]> {
  ensure(input.actor, input.organizationId, "member:read");
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.status ? { status: input.status as never } : {}),
      ...(input.departmentId
        ? { departmentMembers: { some: { departmentId: input.departmentId } } }
        : {}),
      ...(input.query
        ? {
            user: {
              OR: [
                { name: { contains: input.query, mode: "insensitive" } },
                { email: { contains: input.query, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: true,
      roles: { include: { role: true } },
      departmentMembers: { include: { department: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  return memberships.map((m) => ({
    membershipId: m.id,
    publicId: m.publicId,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    status: m.status,
    title: m.title,
    joinedAt: m.joinedAt,
    roles: m.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
    departments: m.departmentMembers.map((dm) => ({
      id: dm.department.id,
      name: dm.department.name,
      isLeader: dm.isLeader,
    })),
  }));
}

export async function listOrganizationRoles(input: {
  actor: Actor;
  organizationId: string;
}): Promise<{ id: string; key: string; name: string }[]> {
  ensure(input.actor, input.organizationId, "member:read");
  const roles = await prisma.role.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({ id: r.id, key: r.key, name: r.name }));
}

async function requireMembership(organizationId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  return membership;
}

export async function updateMember(input: {
  actor: Actor;
  organizationId: string;
  membershipId: string;
  title?: string | null;
  status?: "ACTIVE" | "SUSPENDED";
  roleIds?: string[];
  departmentIds?: string[];
}): Promise<MemberView> {
  ensure(input.actor, input.organizationId, "member:update");
  const membership = await requireMembership(input.organizationId, input.membershipId);

  await prisma.$transaction(async (tx) => {
    if (input.title !== undefined || input.status !== undefined) {
      await tx.membership.update({
        where: { id: membership.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
    }
    if (input.roleIds) {
      const valid = await tx.role.findMany({
        where: { organizationId: input.organizationId, id: { in: input.roleIds } },
        select: { id: true },
      });
      const validIds = new Set(valid.map((r) => r.id));
      await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
      await tx.membershipRole.createMany({
        data: input.roleIds
          .filter((id) => validIds.has(id))
          .map((roleId) => ({ membershipId: membership.id, roleId })),
        skipDuplicates: true,
      });
    }
    if (input.departmentIds) {
      const valid = await tx.department.findMany({
        where: { organizationId: input.organizationId, id: { in: input.departmentIds } },
        select: { id: true },
      });
      const validIds = new Set(valid.map((d) => d.id));
      await tx.departmentMember.deleteMany({ where: { membershipId: membership.id } });
      await tx.departmentMember.createMany({
        data: input.departmentIds
          .filter((id) => validIds.has(id))
          .map((departmentId) => ({ membershipId: membership.id, departmentId })),
        skipDuplicates: true,
      });
    }
  });

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "member:update",
    resourceType: "membership",
    resourceId: membership.id,
    source: "WEB",
    metadata: { title: input.title, status: input.status },
  }).catch(() => undefined);

  const [view] = await listMembers({
    actor: input.actor,
    organizationId: input.organizationId,
    query: undefined,
  }).then((all) => all.filter((m) => m.membershipId === membership.id));
  if (!view) throw new NotFoundError("Member not found");
  return view;
}

export async function removeMember(input: {
  actor: Actor;
  organizationId: string;
  membershipId: string;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "member:remove");
  const membership = await requireMembership(input.organizationId, input.membershipId);
  if (membership.userId === input.actor.userId) {
    throw new ValidationError("You cannot remove yourself");
  }
  // Soft-remove: preserve the record, mark as left (no silent deletion).
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "FORMER", leftAt: new Date() },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "member:remove",
    resourceType: "membership",
    resourceId: membership.id,
    source: "WEB",
  }).catch(() => undefined);
}

export async function listInvitations(input: {
  actor: Actor;
  organizationId: string;
}): Promise<InvitationView[]> {
  ensure(input.actor, input.organizationId, "member:read");
  const invites = await prisma.invitation.findMany({
    where: { organizationId: input.organizationId },
    include: { invitedBy: true },
    orderBy: { createdAt: "desc" },
  });
  return invites.map((i) => ({
    id: i.id,
    publicId: i.publicId,
    email: i.email,
    roleKey: i.roleKey,
    status: i.status,
    invitedByName: i.invitedBy.name,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));
}

export async function resendInvitation(input: {
  actor: Actor;
  organizationId: string;
  invitationId: string;
}): Promise<{ token: string }> {
  ensure(input.actor, input.organizationId, "member:invite");
  const invite = await prisma.invitation.findFirst({
    where: { id: input.invitationId, organizationId: input.organizationId },
  });
  if (!invite) throw new NotFoundError("Invitation not found");
  if (invite.status !== "PENDING")
    throw new ValidationError("Only pending invitations can be resent");
  const token = randomBytes(32).toString("base64url");
  await prisma.invitation.update({
    where: { id: invite.id },
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "member:invite",
    resourceType: "invitation",
    resourceId: invite.id,
    source: "WEB",
    metadata: { resent: true },
  }).catch(() => undefined);
  return { token };
}

export async function revokeInvitation(input: {
  actor: Actor;
  organizationId: string;
  invitationId: string;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "member:invite");
  const invite = await prisma.invitation.findFirst({
    where: { id: input.invitationId, organizationId: input.organizationId },
  });
  if (!invite) throw new NotFoundError("Invitation not found");
  await prisma.invitation.update({
    where: { id: invite.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "member:invite",
    resourceType: "invitation",
    resourceId: invite.id,
    source: "WEB",
    metadata: { revoked: true },
  }).catch(() => undefined);
}

export { createPublicId };

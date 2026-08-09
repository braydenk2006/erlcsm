import { createHash, randomBytes } from "node:crypto";
import { recordAuditEvent } from "@commandry/audit";
import {
  prisma,
  type ApproximateSize,
  type OrganizationType,
  type Prisma,
} from "@commandry/database";
import { authorize, type Actor } from "@commandry/permissions";
import { computeUsage, getOrganizationManifest } from "../subscriptions/service";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
  createPublicId,
} from "@commandry/shared";
import {
  createOrganizationSchema,
  inviteMemberSchema,
  updateOrganizationSchema,
} from "@commandry/validation";

const SYSTEM_ROLES = [
  { key: "owner", name: "Owner", description: "Full organization control" },
  { key: "admin", name: "Administrator", description: "Administrative access" },
  { key: "moderator", name: "Moderator", description: "Moderation access" },
  { key: "staff", name: "Staff", description: "Operational staff access" },
  { key: "member", name: "Member", description: "Baseline membership" },
] as const;

function mapOrganizationType(value: string): OrganizationType {
  const map: Record<string, OrganizationType> = {
    private_server: "PRIVATE_SERVER",
    roleplay: "ROLEPLAY",
    department_heavy: "DEPARTMENT_HEAVY",
    law_enforcement: "LAW_ENFORCEMENT",
    border_roleplay: "BORDER_ROLEPLAY",
    custom: "CUSTOM",
  };
  return map[value] ?? "CUSTOM";
}

function mapSize(value: string): ApproximateSize {
  const map: Record<string, ApproximateSize> = {
    small: "SMALL",
    medium: "MEDIUM",
    large: "LARGE",
    enterprise: "ENTERPRISE",
  };
  return map[value] ?? "SMALL";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createOrganization(input: {
  userId: string;
  data: unknown;
  requestId?: string;
}) {
  const parsed = createOrganizationSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new ValidationError("Invalid organization payload", {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.organization.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    throw new ConflictError("Organization slug is already taken");
  }

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        publicId: createPublicId("org"),
        name: parsed.data.name,
        slug: parsed.data.slug,
        timezone: parsed.data.timezone,
        organizationType: mapOrganizationType(parsed.data.organizationType),
        approximateSize: mapSize(parsed.data.approximateSize),
        onboardingStep: 1,
      },
    });

    const roles = await Promise.all(
      SYSTEM_ROLES.map((role) =>
        tx.role.create({
          data: {
            publicId: createPublicId("role"),
            organizationId: created.id,
            key: role.key,
            name: role.name,
            description: role.description,
            isSystem: true,
          },
        }),
      ),
    );

    const ownerRole = roles.find((role) => role.key === "owner");
    if (!ownerRole) {
      throw new Error("Owner role was not created");
    }

    const membership = await tx.membership.create({
      data: {
        publicId: createPublicId("mem"),
        organizationId: created.id,
        userId: input.userId,
        status: "ACTIVE",
      },
    });

    await tx.membershipRole.create({
      data: {
        membershipId: membership.id,
        roleId: ownerRole.id,
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { activeOrganizationId: created.id },
    });

    return created;
  });

  await recordAuditEvent({
    organizationId: organization.id,
    actorUserId: input.userId,
    action: "organization.created",
    resourceType: "organization",
    resourceId: organization.id,
    requestId: input.requestId,
    source: "WEB",
    after: {
      name: organization.name,
      slug: organization.slug,
    },
  });

  return organization;
}

export async function listMembershipsForUser(userId: string) {
  return prisma.membership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { deletedAt: null },
    },
    include: {
      organization: true,
      roles: { include: { role: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
}

export async function getOrganizationForActor(actor: Actor, organizationPublicId: string) {
  const organization = await prisma.organization.findFirst({
    where: {
      OR: [{ publicId: organizationPublicId }, { id: organizationPublicId }],
      deletedAt: null,
    },
  });
  if (!organization) {
    throw new NotFoundError("Organization");
  }

  // Never rewrite the actor's organizationId to the target resource's tenant.
  // Cross-tenant access must fail even when the actor is an owner elsewhere.
  if (actor.organizationId !== organization.id) {
    throw new ForbiddenError("Actor is not operating within the requested organization");
  }

  const decision = authorize({
    actor,
    organizationId: organization.id,
    action: "organization:read",
    resource: {
      type: "organization",
      id: organization.id,
      organizationId: organization.id,
    },
  });

  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason);
  }

  return organization;
}

export async function updateOrganization(input: {
  actor: Actor;
  organizationId: string;
  data: unknown;
  requestId?: string;
}) {
  const parsed = updateOrganizationSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new ValidationError("Invalid organization update", {
      issues: parsed.error.issues,
    });
  }

  const decision = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "organization:update",
  });
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason);
  }

  const before = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!before || before.deletedAt) {
    throw new NotFoundError("Organization");
  }

  const updated = await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
      ...(parsed.data.accentColor ? { accentColor: parsed.data.accentColor } : {}),
      ...(parsed.data.terminology
        ? { terminology: parsed.data.terminology as Prisma.InputJsonValue }
        : {}),
    },
  });

  await recordAuditEvent({
    organizationId: updated.id,
    actorUserId: input.actor.userId,
    action: "organization.updated",
    resourceType: "organization",
    resourceId: updated.id,
    requestId: input.requestId,
    source: "WEB",
    before: { name: before.name, timezone: before.timezone },
    after: { name: updated.name, timezone: updated.timezone },
  });

  return updated;
}

export async function switchActiveOrganization(input: {
  userId: string;
  organizationId: string;
  requestId?: string;
}) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    include: { organization: true },
  });

  if (!membership || membership.organization.deletedAt) {
    throw new ForbiddenError("You are not an active member of that organization");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { activeOrganizationId: membership.organizationId },
  });

  await recordAuditEvent({
    organizationId: membership.organizationId,
    actorUserId: input.userId,
    action: "organization.switched",
    resourceType: "organization",
    resourceId: membership.organizationId,
    requestId: input.requestId,
    source: "WEB",
  });

  return membership.organization;
}

export async function inviteMember(input: {
  actor: Actor;
  organizationId: string;
  data: unknown;
  requestId?: string;
}) {
  const parsed = inviteMemberSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new ValidationError("Invalid invitation", { issues: parsed.error.issues });
  }

  const decision = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "member:invite",
  });
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason);
  }

  // Enforce the plan's member limit (active members + this pending invite).
  const manifest = await getOrganizationManifest(input.organizationId);
  const memberUsage = await computeUsage(input.organizationId, "members.max");
  if (memberUsage + 1 > manifest.getLimit("members.max")) {
    throw new LimitExceededError("members.max", manifest.getLimit("members.max"));
  }

  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.invitation.create({
    data: {
      publicId: createPublicId("inv"),
      organizationId: input.organizationId,
      email: parsed.data.email.toLowerCase(),
      roleKey: parsed.data.roleKey,
      tokenHash: hashToken(token),
      message: parsed.data.message,
      invitedById: input.actor.userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "invitation.created",
    resourceType: "invitation",
    resourceId: invitation.id,
    requestId: input.requestId,
    source: "WEB",
    metadata: { email: invitation.email, roleKey: invitation.roleKey },
  });

  // Return raw token only at creation time for email delivery. Never store plaintext.
  return { invitation, token };
}

export async function acceptInvitation(input: {
  userId: string;
  email: string;
  token: string;
  requestId?: string;
}) {
  const invitation = await prisma.invitation.findFirst({
    where: {
      tokenHash: hashToken(input.token),
      status: "PENDING",
    },
    include: { organization: true },
  });

  if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
    throw new NotFoundError("Invitation");
  }

  if (invitation.email.toLowerCase() !== input.email.toLowerCase()) {
    throw new ForbiddenError("Invitation email does not match the signed-in account");
  }

  const membership = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: {
        organizationId_key: {
          organizationId: invitation.organizationId,
          key: invitation.roleKey,
        },
      },
    });
    if (!role) {
      throw new ValidationError("Invitation role no longer exists");
    }

    const created = await tx.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: input.userId,
        },
      },
      update: {
        status: "ACTIVE",
        leftAt: null,
      },
      create: {
        publicId: createPublicId("mem"),
        organizationId: invitation.organizationId,
        userId: input.userId,
        status: "ACTIVE",
      },
    });

    await tx.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: created.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        membershipId: created.id,
        roleId: role.id,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { activeOrganizationId: invitation.organizationId },
    });

    return created;
  });

  await recordAuditEvent({
    organizationId: invitation.organizationId,
    actorUserId: input.userId,
    action: "invitation.accepted",
    resourceType: "invitation",
    resourceId: invitation.id,
    requestId: input.requestId,
    source: "WEB",
  });

  return { membership, organization: invitation.organization };
}

export async function buildActorForUser(userId: string, organizationId: string): Promise<Actor> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      status: "ACTIVE",
    },
    include: {
      roles: { include: { role: true } },
      permissionGrants: true,
      departmentMembers: true,
      breakGlassSessions: {
        where: { endsAt: { gt: new Date() } },
        orderBy: { endsAt: "desc" },
        take: 1,
      },
      rank: true,
      user: true,
    },
  });

  if (!membership) {
    throw new ForbiddenError("No active membership in this organization");
  }

  return {
    userId,
    membershipId: membership.id,
    organizationId,
    roleKeys: membership.roles.map((item) => item.role.key),
    permissionKeys: [
      ...membership.roles.flatMap((item) => item.role.permissions),
      ...membership.permissionGrants.map((grant) => grant.action),
    ],
    departmentIds: membership.departmentMembers.map((item) => item.departmentId),
    rankOrder: membership.rank?.order ?? null,
    isPlatformAdmin: ["ADMIN", "SUPERADMIN", "SUPPORT"].includes(membership.user.platformRole),
    breakGlassUntil: membership.breakGlassSessions[0]?.endsAt ?? null,
  };
}

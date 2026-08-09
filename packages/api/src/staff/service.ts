import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { getOrganizationManifest } from "../subscriptions/service";

/**
 * Ordinex Internal Staff Panel service. Platform-staff access is authoritative
 * from `user.platformRole` (server-side, never from client input) and is
 * completely separate from tenant/org permissions — being an org Owner or
 * Enterprise Owner grants nothing here.
 */
export type PlatformRole = "NONE" | "SUPPORT" | "ADMIN" | "SUPERADMIN";
const TIER: Record<PlatformRole, number> = { NONE: 0, SUPPORT: 1, ADMIN: 2, SUPERADMIN: 3 };

export async function getPlatformRole(userId: string): Promise<PlatformRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  return (user?.platformRole as PlatformRole | undefined) ?? "NONE";
}

/** Server-verified platform-staff gate. Throws unless the user meets `min`. */
export async function requirePlatformStaff(
  userId: string,
  min: PlatformRole = "SUPPORT",
): Promise<{ userId: string; role: PlatformRole }> {
  const role = await getPlatformRole(userId);
  if (TIER[role] < TIER[min]) throw new ForbiddenError("Ordinex staff access required");
  return { userId, role };
}

export function isPlatformStaff(role: PlatformRole): boolean {
  return TIER[role] >= TIER.SUPPORT;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type StaffOverview = {
  role: PlatformRole;
  openTickets: number;
  urgentTickets: number;
  assignedToMe: number;
  activeSupportSessions: number;
  failedWebhookDeliveries24h: number;
  recentOrganizations: { id: string; name: string; plan: string; createdAt: string }[];
  recentStaffActivity: { at: string; action: string }[];
};

export async function getStaffOverview(input: { staffUserId: string }): Promise<StaffOverview> {
  const { role } = await requirePlatformStaff(input.staffUserId);
  const now = new Date();
  const [
    openTickets,
    urgentTickets,
    assignedToMe,
    activeSessions,
    failedWebhooks,
    recentOrgs,
    recentAudit,
  ] = await Promise.all([
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "ASSIGNED", "WAITING_ON_ORDINEX", "ESCALATED"] } },
    }),
    prisma.supportTicket.count({
      where: {
        priority: { in: ["URGENT", "CRITICAL"] },
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
    }),
    prisma.supportTicket.count({
      where: { assigneeUserId: input.staffUserId, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.supportAccessSession.count({ where: { endsAt: { gt: now }, revokedAt: null } }),
    prisma.webhookDelivery.count({
      where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        createdAt: true,
        subscription: { select: { planKey: true } },
      },
    }),
    prisma.auditEvent.findMany({
      where: { source: "PLATFORM_SUPPORT" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { action: true, createdAt: true },
    }),
  ]);
  return {
    role,
    openTickets,
    urgentTickets,
    assignedToMe,
    activeSupportSessions: activeSessions,
    failedWebhookDeliveries24h: failedWebhooks,
    recentOrganizations: recentOrgs.map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.subscription?.planKey ?? "startup",
      createdAt: o.createdAt.toISOString(),
    })),
    recentStaffActivity: recentAudit.map((a) => ({
      at: a.createdAt.toISOString(),
      action: a.action,
    })),
  };
}

// ---------------------------------------------------------------------------
// Customer + organization lookup
// ---------------------------------------------------------------------------

export type CustomerHit = {
  kind: "organization" | "user";
  id: string;
  label: string;
  sublabel: string;
};

export async function searchCustomers(input: {
  staffUserId: string;
  query: string;
}): Promise<CustomerHit[]> {
  await requirePlatformStaff(input.staffUserId);
  const q = input.query.trim();
  if (q.length < 2) return [];
  const like = { contains: q, mode: "insensitive" as const };
  const [orgs, users] = await Promise.all([
    prisma.organization.findMany({
      where: { OR: [{ name: like }, { slug: like }, { publicId: like }, { id: q }] },
      take: 10,
      select: { id: true, name: true, slug: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ email: like }, { name: like }, { id: q }] },
      take: 10,
      select: { id: true, name: true, email: true },
    }),
  ]);
  return [
    ...orgs.map((o) => ({
      kind: "organization" as const,
      id: o.id,
      label: o.name,
      sublabel: o.slug,
    })),
    ...users.map((u) => ({ kind: "user" as const, id: u.id, label: u.name, sublabel: u.email })),
  ];
}

export type OrgSupportProfile = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: string;
  subscriptionStatus: string;
  memberCount: number;
  departmentCount: number;
  integrations: { provider: string; status: string }[];
  webhookEndpoints: number;
  apiKeys: number;
  entitledFeatures: number;
  openTickets: number;
};

export async function getOrganizationSupportProfile(input: {
  staffUserId: string;
  organizationId: string;
}): Promise<OrgSupportProfile> {
  await requirePlatformStaff(input.staffUserId);
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      subscription: { select: { planKey: true, status: true } },
    },
  });
  if (!org) throw new NotFoundError("Organization not found");
  const [memberCount, departmentCount, creds, webhooks, apiKeys, openTickets, manifest] =
    await Promise.all([
      prisma.membership.count({ where: { organizationId: org.id, status: "ACTIVE" } }),
      prisma.department.count({ where: { organizationId: org.id } }),
      prisma.integrationCredential.findMany({
        where: { organizationId: org.id },
        select: { provider: true, status: true },
      }),
      prisma.webhookEndpoint.count({ where: { organizationId: org.id } }),
      prisma.apiKey.count({ where: { organizationId: org.id, status: "active" } }),
      prisma.supportTicket.count({
        where: { organizationId: org.id, status: { notIn: ["RESOLVED", "CLOSED"] } },
      }),
      getOrganizationManifest(org.id).catch(() => null),
    ]);
  const entitledFeatures = manifest
    ? Object.values(manifest.features as Record<string, boolean>).filter(Boolean).length
    : 0;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
    plan: org.subscription?.planKey ?? "startup",
    subscriptionStatus: org.subscription?.status ?? "none",
    memberCount,
    departmentCount,
    integrations: creds.map((c) => ({ provider: c.provider, status: c.status })),
    webhookEndpoints: webhooks,
    apiKeys,
    entitledFeatures,
    openTickets,
  };
}

export type UserSupportProfile = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  mfaEnabled: boolean;
  robloxLinked: boolean;
  discordLinked: boolean;
  memberships: { organization: string; roles: string[] }[];
  activeSessions: number;
};

export async function getUserSupportProfile(input: {
  staffUserId: string;
  userId: string;
}): Promise<UserSupportProfile> {
  await requirePlatformStaff(input.staffUserId);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      deletedAt: true,
      createdAt: true,
      mfaEnabled: true,
      robloxLink: { select: { id: true } },
      discordLink: { select: { id: true } },
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          organization: { select: { name: true } },
          roles: { select: { role: { select: { key: true } } } },
        },
      },
      sessions: { where: { expiresAt: { gt: new Date() } }, select: { id: true } },
    },
  });
  if (!user) throw new NotFoundError("User not found");
  // NEVER expose password hashes, OAuth/session/API secrets, or encryption keys.
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.deletedAt ? "deleted" : "active",
    createdAt: user.createdAt.toISOString(),
    mfaEnabled: user.mfaEnabled,
    robloxLinked: Boolean(user.robloxLink),
    discordLinked: Boolean(user.discordLink),
    memberships: user.memberships.map((m) => ({
      organization: m.organization.name,
      roles: m.roles.map((r) => r.role.key),
    })),
    activeSessions: user.sessions.length,
  };
}

// ---------------------------------------------------------------------------
// Controlled support sessions (reuse SupportAccessSession)
// ---------------------------------------------------------------------------

export const SUPPORT_SCOPES = [
  "VIEW_CONFIGURATION",
  "VIEW_AS_CUSTOMER",
  "DIAGNOSE_INTEGRATIONS",
  "DIAGNOSE_ENTITLEMENTS",
  "DIAGNOSE_BILLING",
  "DIAGNOSE_FEATURE",
] as const;
export type SupportScope = (typeof SUPPORT_SCOPES)[number];

export type SupportSessionView = {
  id: string;
  organizationId: string;
  organizationName: string;
  staffName: string;
  reason: string;
  scope: string;
  mode: string;
  ticketId: string | null;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  active: boolean;
};

async function toSessionView(s: {
  id: string;
  organizationId: string;
  reason: string;
  scope: string;
  mode: string;
  ticketId: string | null;
  startsAt: Date;
  endsAt: Date;
  revokedAt: Date | null;
  organization: { name: string };
  actor: { name: string };
}): Promise<SupportSessionView> {
  const active = s.revokedAt === null && s.endsAt.getTime() > Date.now();
  return {
    id: s.id,
    organizationId: s.organizationId,
    organizationName: s.organization.name,
    staffName: s.actor.name,
    reason: s.reason,
    scope: s.scope,
    mode: s.mode,
    ticketId: s.ticketId,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
    active,
  };
}

export async function startSupportSession(input: {
  staffUserId: string;
  organizationId: string;
  reason: string;
  scope: SupportScope;
  mode?: "read_only" | "elevated";
  durationMinutes?: number;
  ticketId?: string;
}): Promise<SupportSessionView> {
  const { role } = await requirePlatformStaff(input.staffUserId);
  if (input.reason.trim().length < 4) throw new ValidationError("A support reason is required");
  if (!(SUPPORT_SCOPES as readonly string[]).includes(input.scope))
    throw new ValidationError("Invalid scope");
  const mode = input.mode ?? "read_only";
  // Elevated (write-capable) sessions require ADMIN+ and an explicit reason.
  if (mode === "elevated" && TIER[role] < TIER.ADMIN)
    throw new ForbiddenError("Elevated support sessions require a platform admin");
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });
  if (!org) throw new NotFoundError("Organization not found");
  const minutes = Math.min(240, Math.max(5, input.durationMinutes ?? 60));
  const session = await prisma.supportAccessSession.create({
    data: {
      publicId: createPublicId("supp"),
      organizationId: input.organizationId,
      actorUserId: input.staffUserId,
      reason: input.reason.trim(),
      scope: input.scope,
      mode,
      ticketId: input.ticketId ?? null,
      endsAt: new Date(Date.now() + minutes * 60_000),
    },
    include: { organization: { select: { name: true } }, actor: { select: { name: true } } },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.staffUserId,
    action: "support.session.start",
    resourceType: "support_access_session",
    resourceId: session.id,
    source: "PLATFORM_SUPPORT",
    metadata: {
      scope: input.scope,
      mode,
      ticketId: input.ticketId ?? null,
      reason: input.reason.trim(),
    },
  }).catch(() => undefined);
  return toSessionView(session);
}

export async function getActiveSupportSession(input: {
  staffUserId: string;
  organizationId: string;
}): Promise<SupportSessionView | null> {
  await requirePlatformStaff(input.staffUserId);
  const s = await prisma.supportAccessSession.findFirst({
    where: {
      organizationId: input.organizationId,
      actorUserId: input.staffUserId,
      revokedAt: null,
      endsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "desc" },
    include: { organization: { select: { name: true } }, actor: { select: { name: true } } },
  });
  return s ? toSessionView(s) : null;
}

export async function revokeSupportSession(input: {
  staffUserId: string;
  id: string;
}): Promise<void> {
  await requirePlatformStaff(input.staffUserId);
  const s = await prisma.supportAccessSession.findUnique({ where: { id: input.id } });
  if (!s) throw new NotFoundError("Session not found");
  await prisma.supportAccessSession.update({
    where: { id: s.id },
    data: { revokedAt: new Date() },
  });
  await recordAuditEvent({
    organizationId: s.organizationId,
    actorUserId: input.staffUserId,
    action: "support.session.revoke",
    resourceType: "support_access_session",
    resourceId: s.id,
    source: "PLATFORM_SUPPORT",
  }).catch(() => undefined);
}

export async function listSupportSessions(input: {
  staffUserId: string;
  organizationId?: string;
}): Promise<SupportSessionView[]> {
  await requirePlatformStaff(input.staffUserId);
  const rows = await prisma.supportAccessSession.findMany({
    where: { ...(input.organizationId ? { organizationId: input.organizationId } : {}) },
    orderBy: { startsAt: "desc" },
    take: 50,
    include: { organization: { select: { name: true } }, actor: { select: { name: true } } },
  });
  return Promise.all(rows.map(toSessionView));
}

/** Customer-visible support-access history (who from Ordinex accessed their org). */
export async function listSupportAccessForOrganization(organizationId: string): Promise<
  {
    staffName: string;
    reason: string;
    scope: string;
    mode: string;
    startsAt: string;
    endsAt: string;
    revokedAt: string | null;
  }[]
> {
  const rows = await prisma.supportAccessSession.findMany({
    where: { organizationId },
    orderBy: { startsAt: "desc" },
    take: 25,
    include: { actor: { select: { name: true } } },
  });
  return rows.map((s) => ({
    staffName: s.actor.name,
    reason: s.reason,
    scope: s.scope,
    mode: s.mode,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
  }));
}

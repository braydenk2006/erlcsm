import { listMembershipsForUser } from "@commandry/api";
import { NotFoundError } from "@commandry/shared";
import { requireSession } from "@/lib/session";

export type ActiveOrganizationContext = {
  userId: string;
  organizationId: string;
  organization: {
    id: string;
    publicId: string;
    name: string;
    slug: string;
  };
  roleKeys: string[];
};

/**
 * Resolve the caller's active organization from their session. Throws
 * UnauthorizedError when unauthenticated and NotFoundError when the user has no
 * organization membership.
 */
export async function requireActiveOrganization(): Promise<ActiveOrganizationContext> {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);
  const activeOrganizationId =
    (session.user as { activeOrganizationId?: string | null }).activeOrganizationId ??
    memberships[0]?.organizationId;
  const active =
    memberships.find((membership) => membership.organizationId === activeOrganizationId) ??
    memberships[0];

  if (!active) {
    throw new NotFoundError("Organization");
  }

  return {
    userId: session.user.id,
    organizationId: active.organizationId,
    organization: {
      id: active.organization.id,
      publicId: active.organization.publicId,
      name: active.organization.name,
      slug: active.organization.slug,
    },
    roleKeys: active.roles.map((role) => role.role.key),
  };
}

/** Resolve an organization's internal id from its public id (webhook routing). */
export async function resolveOrganizationByPublicId(
  publicId: string,
): Promise<{ id: string; publicId: string; name: string } | null> {
  const { prisma } = await import("@commandry/database");
  return prisma.organization.findUnique({
    where: { publicId },
    select: { id: true, publicId: true, name: true },
  });
}

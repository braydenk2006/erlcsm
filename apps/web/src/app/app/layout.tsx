import { redirect } from "next/navigation";
import { buildActorForUser, listMembershipsForUser } from "@commandry/api";
import { authorize } from "@commandry/permissions";
import { getSession } from "@/lib/session";
import { getManifest } from "@/lib/entitlements";
import { NAV_REGISTRY, type NavItem } from "@/lib/nav-registry";
import { AppShell } from "@/components/app-shell";

// Every route under /app is authenticated and renders per-user, per-organization
// data derived from the session cookie, so it is inherently dynamic and must not
// be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const memberships = await listMembershipsForUser(session.user.id);
  const activeOrganizationId =
    (session.user as { activeOrganizationId?: string | null }).activeOrganizationId ??
    memberships[0]?.organizationId ??
    null;
  const activeMembership =
    memberships.find((membership) => membership.organizationId === activeOrganizationId) ??
    memberships[0] ??
    null;

  // Build navigation from the entitlement manifest + actor permissions. Only
  // entries whose feature is entitled AND permission is satisfied are rendered.
  let nav: NavItem[] = [];
  if (activeMembership) {
    const orgId = activeMembership.organizationId;
    const [manifest, actor] = await Promise.all([
      getManifest(orgId),
      buildActorForUser(session.user.id, orgId),
    ]);
    nav = NAV_REGISTRY.filter((entry) => {
      if (entry.feature && !manifest.hasFeature(entry.feature)) return false;
      if (entry.permission) {
        const decision = authorize({ actor, organizationId: orgId, action: entry.permission });
        if (!decision.allowed) return false;
      }
      return true;
    }).map((entry) => ({
      key: entry.key,
      label: entry.label,
      href: entry.href,
      iconName: entry.iconName,
    }));
  }

  return (
    <AppShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
      organizations={memberships.map((membership) => ({
        id: membership.organization.id,
        publicId: membership.organization.publicId,
        name: membership.organization.name,
        slug: membership.organization.slug,
      }))}
      activeOrganization={
        activeMembership
          ? {
              id: activeMembership.organization.id,
              publicId: activeMembership.organization.publicId,
              name: activeMembership.organization.name,
              slug: activeMembership.organization.slug,
            }
          : null
      }
      nav={nav}
    >
      {children}
    </AppShell>
  );
}

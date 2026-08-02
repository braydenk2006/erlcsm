import { redirect } from "next/navigation";
import { listMembershipsForUser } from "@commandry/api";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

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
              enabledModules: activeMembership.organization.enabledModules,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}

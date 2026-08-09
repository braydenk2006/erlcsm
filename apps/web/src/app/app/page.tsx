import Link from "next/link";
import { getDashboard, listMembershipsForUser } from "@commandry/api";
import { Button, EmptyState } from "@commandry/ui";
import { CommandCenter } from "@/components/command-center/command-center";
import { requireActor } from "@/lib/actor";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command Center" };

export default async function HomePage() {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);
  const activeOrganizationId =
    (session.user as { activeOrganizationId?: string | null }).activeOrganizationId ??
    memberships[0]?.organizationId;
  const active = memberships.find((item) => item.organizationId === activeOrganizationId);

  if (!active) {
    return (
      <EmptyState
        title="Create your first community"
        description="Ordinex workspaces are organization-scoped. Start onboarding to configure ranks, departments, and integrations."
        action={
          <Button asChild>
            <Link href="/app/onboarding">Start onboarding</Link>
          </Button>
        }
      />
    );
  }

  const { actor, organizationId } = await requireActor();
  const dashboard = await getDashboard({ actor, organizationId });

  return <CommandCenter initial={dashboard} orgName={active.organization.name} />;
}

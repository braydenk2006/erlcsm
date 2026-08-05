import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { MembersView } from "@/components/org/members-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "core.members"))) {
    return <PlanRequired feature="core.members" />;
  }
  if (!authorize({ actor, organizationId, action: "member:read" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view members." />
    );
  }
  return <MembersView />;
}

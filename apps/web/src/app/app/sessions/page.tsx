import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { SessionsView } from "@/components/operations/sessions-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Sessions" };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "sessions.management"))) {
    return <PlanRequired feature="sessions.management" />;
  }
  if (!authorize({ actor, organizationId, action: "session:read" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view sessions." />
    );
  }
  const canManage = authorize({ actor, organizationId, action: "session:manage" }).allowed;
  return <SessionsView canManage={canManage} />;
}

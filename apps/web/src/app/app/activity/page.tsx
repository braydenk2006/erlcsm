import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { ActivityView } from "@/components/operations/activity-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "activity.tracking"))) {
    return <PlanRequired feature="activity.tracking" />;
  }
  if (!authorize({ actor, organizationId, action: "activity:read" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view activity." />
    );
  }
  return <ActivityView />;
}

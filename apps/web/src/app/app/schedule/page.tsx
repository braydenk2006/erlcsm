import { authorize } from "@commandry/permissions";
import { listMembers } from "@commandry/api";
import { EmptyState } from "@commandry/ui";
import { ScheduleView } from "@/components/operations/schedule-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "shifts.tracking"))) {
    return <PlanRequired feature="shifts.tracking" />;
  }
  if (!authorize({ actor, organizationId, action: "shifts.attendance.view" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to view the schedule."
      />
    );
  }
  const canManage = authorize({ actor, organizationId, action: "shifts.schedule" }).allowed;
  const members = (await listMembers({ actor, organizationId, status: "ACTIVE" })).map((m) => ({
    membershipId: m.membershipId,
    name: m.name,
  }));
  return <ScheduleView canManage={canManage} members={members} />;
}

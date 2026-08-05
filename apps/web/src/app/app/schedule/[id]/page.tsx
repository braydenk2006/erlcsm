import Link from "next/link";
import { authorize } from "@commandry/permissions";
import { listMembers } from "@commandry/api";
import { Button, EmptyState } from "@commandry/ui";
import { ShiftDetail } from "@/components/operations/shift-detail";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Shift" };
export const dynamic = "force-dynamic";

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "shifts.tracking"))) {
    return <PlanRequired feature="shifts.tracking" />;
  }
  if (!authorize({ actor, organizationId, action: "shifts.attendance.view" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view this shift." />
    );
  }
  const { id } = await params;
  const canManage = authorize({ actor, organizationId, action: "shifts.schedule" }).allowed;
  const members = (await listMembers({ actor, organizationId, status: "ACTIVE" })).map((m) => ({
    membershipId: m.membershipId,
    name: m.name,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Scheduled shift</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/schedule">Back to schedule</Link>
        </Button>
      </div>
      <ShiftDetail shiftId={id} members={members} canManage={canManage} />
    </div>
  );
}

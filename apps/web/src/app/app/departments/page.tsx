import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { DepartmentsView } from "@/components/org/departments-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Departments" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "core.departments"))) {
    return <PlanRequired feature="core.departments" />;
  }
  if (!authorize({ actor, organizationId, action: "department:read" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view departments." />
    );
  }
  return <DepartmentsView />;
}

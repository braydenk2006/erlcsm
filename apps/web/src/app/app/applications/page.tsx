import { WorkflowView } from "@/components/workflow/workflow-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const { organizationId } = await requireActor();
  if (!(await hasFeature(organizationId, "applications.basic"))) {
    return <PlanRequired feature="applications.basic" />;
  }
  return <WorkflowView title="Applications" category="application" />;
}

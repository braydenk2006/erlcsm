import { WorkflowView } from "@/components/workflow/workflow-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const { organizationId } = await requireActor();
  if (!(await hasFeature(organizationId, "forms.basic"))) {
    return <PlanRequired feature="forms.basic" />;
  }
  return <WorkflowView title="Forms" />;
}

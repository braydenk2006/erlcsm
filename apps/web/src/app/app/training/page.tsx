import { WorkflowView } from "@/components/workflow/workflow-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Training" };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { organizationId } = await requireActor();
  if (!(await hasFeature(organizationId, "training.basic"))) {
    return <PlanRequired feature="training.basic" />;
  }
  return <WorkflowView title="Training" category="training" />;
}

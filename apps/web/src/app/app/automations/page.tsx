import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { AutomationsView } from "@/components/automation/automations-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Automations" };
export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "automations.builder"))) {
    return <PlanRequired feature="automations.builder" />;
  }
  if (!authorize({ actor, organizationId, action: "automation.view" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to manage automations."
      />
    );
  }
  return <AutomationsView />;
}

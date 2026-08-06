import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { InsightsView } from "@/components/insights/insights-view";
import { requireActor } from "@/lib/actor";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { actor, organizationId } = await requireActor();
  if (!authorize({ actor, organizationId, action: "insights.view" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view insights." />
    );
  }
  return <InsightsView />;
}

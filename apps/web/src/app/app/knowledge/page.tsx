import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { KnowledgeView } from "@/components/knowledge/knowledge-view";
import { requireActor } from "@/lib/actor";

export const metadata = { title: "Knowledge" };
export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { actor, organizationId } = await requireActor();
  if (!authorize({ actor, organizationId, action: "knowledge.view" }).allowed) {
    return (
      <EmptyState title="No access" description="You do not have permission to view knowledge." />
    );
  }
  const canManage = authorize({ actor, organizationId, action: "knowledge.manage" }).allowed;
  const { new: isNew } = await searchParams;
  return <KnowledgeView canManage={canManage} initialNew={isNew === "1"} />;
}

import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { AssistantView } from "@/components/ai/assistant-view";
import { requireActor } from "@/lib/actor";

export const metadata = { title: "Ask Ordinex" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { actor, organizationId } = await requireActor();
  if (!authorize({ actor, organizationId, action: "ai.use" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to use the assistant."
      />
    );
  }
  const { q } = await searchParams;
  return <AssistantView initialQuestion={q} />;
}

import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { RmsConsole } from "@/components/rms/rms-console";
import { requireActor } from "@/lib/actor";

export const metadata = { title: "RMS" };
export const dynamic = "force-dynamic";

export default async function RmsPage() {
  const { actor, organizationId } = await requireActor();
  if (!authorize({ actor, organizationId, action: "rms.view" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to access the Records Management System."
      />
    );
  }
  const canManageCases = authorize({ actor, organizationId, action: "cases.create" }).allowed;
  return <RmsConsole canManageCases={canManageCases} />;
}

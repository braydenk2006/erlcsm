import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { AnnouncementsView } from "@/components/org/announcements-view";
import { PlanRequired } from "@/components/plan-required";
import { requireActor } from "@/lib/actor";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { organizationId, actor } = await requireActor();
  if (!(await hasFeature(organizationId, "announcements.management"))) {
    return <PlanRequired feature="announcements.management" />;
  }
  if (!authorize({ actor, organizationId, action: "announcement:read" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to view announcements."
      />
    );
  }
  const canManage = authorize({ actor, organizationId, action: "announcement:manage" }).allowed;
  return <AnnouncementsView canManage={canManage} />;
}

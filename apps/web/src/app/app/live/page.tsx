import { LiveServerDashboard } from "@/components/live/live-server-dashboard";
import { requireActiveOrganization } from "@/lib/organization";
import { hasFeature } from "@/lib/entitlements";
import { PlanRequired } from "@/components/plan-required";

export const metadata = { title: "Live Server" };

export default async function LiveServerPage() {
  const { organizationId } = await requireActiveOrganization();
  if (!(await hasFeature(organizationId, "server.live_status"))) {
    return <PlanRequired feature="server.live_status" />;
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
          Live Server
        </p>
        <h1 className="mt-1 font-[family-name:var(--cmd-font-display)] text-4xl tracking-tight">
          ER:LC Operations
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
          Real-time roster, teams, map, vehicles, and logs with a remote command console. Connect a
          server key under Integrations to switch from the simulator to your live server.
        </p>
      </div>
      <LiveServerDashboard />
    </div>
  );
}

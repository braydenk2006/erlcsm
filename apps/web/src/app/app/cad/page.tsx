import { Badge, EmptyState } from "@commandry/ui";
import { listCadCalls, listPlayerHistory } from "@commandry/integrations";
import { CadSyncButton } from "@/components/cad/cad-sync-button";
import { requireActiveOrganization } from "@/lib/organization";

export const metadata = { title: "CAD" };

function callTone(status: string): "danger" | "warning" | "neutral" {
  if (status === "ACTIVE") return "danger";
  if (status === "CLOSED") return "neutral";
  return "warning";
}

export default async function CadPage() {
  const { organizationId } = await requireActiveOrganization();
  const [calls, history] = await Promise.all([
    listCadCalls(organizationId),
    listPlayerHistory(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">CAD</p>
          <h1 className="mt-1 font-[family-name:var(--cmd-font-display)] text-4xl tracking-tight">
            Computer-Aided Dispatch
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
            Emergency calls synchronized from the ER:LC server, plus player-history correlation
            against known Roblox identities.
          </p>
        </div>
        <CadSyncButton />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Active & recent calls</h2>
        {calls.length === 0 ? (
          <EmptyState
            title="No calls synchronized yet"
            description="Run a sync from the live server, or point your ER:LC 911 webhook at the Integrations endpoint."
          />
        ) : (
          <div className="cmd-glass overflow-x-auto rounded-[var(--cmd-radius-xl)] p-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                <tr className="border-b border-[var(--cmd-border)]">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Caller</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Opened</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-[var(--cmd-border)]/60">
                    <td className="px-3 py-2">
                      <Badge tone={callTone(call.status)}>{call.status}</Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{call.caller}</td>
                    <td className="px-3 py-2">{call.message}</td>
                    <td className="px-3 py-2 text-[var(--cmd-fg-muted)]">{call.location ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-[var(--cmd-fg-muted)]">
                      {call.openedAt.toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Player history</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No player history yet"
            description="Sync from the live server to roll up player presence and correlate it with Roblox identities."
          />
        ) : (
          <div className="cmd-glass overflow-x-auto rounded-[var(--cmd-radius-xl)] p-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                <tr className="border-b border-[var(--cmd-border)]">
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Roblox ID</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Callsign</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--cmd-border)]/60">
                    <td className="px-3 py-2 font-medium">{row.robloxUsername}</td>
                    <td className="px-3 py-2 font-[family-name:var(--cmd-font-mono)] text-xs text-[var(--cmd-fg-muted)]">
                      {row.robloxUserId}
                    </td>
                    <td className="px-3 py-2">{row.team ?? "—"}</td>
                    <td className="px-3 py-2 font-[family-name:var(--cmd-font-mono)] text-xs">
                      {row.callsign ?? "—"}
                    </td>
                    <td className="px-3 py-2">{row.sessionCount}</td>
                    <td className="px-3 py-2">
                      {row.linkedToRoblox ? (
                        <Badge tone="success">Linked</Badge>
                      ) : (
                        <Badge tone="neutral">Unlinked</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

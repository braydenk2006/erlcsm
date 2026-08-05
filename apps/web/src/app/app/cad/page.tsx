import { CadWorkspace } from "@/components/cad/cad-workspace";
import { requireActiveOrganization } from "@/lib/organization";

export const metadata = { title: "CAD / MDT" };

export default async function CadPage() {
  await requireActiveOrganization();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">CAD / MDT</p>
        <h1 className="mt-1 font-[family-name:var(--cmd-font-display)] text-4xl tracking-tight">
          Computer-Aided Dispatch
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
          Dispatch units to calls, run names and plates, manage civilians, warrants, citations, and
          BOLOs — synchronized with your ER:LC server.
        </p>
      </div>
      <CadWorkspace />
    </div>
  );
}

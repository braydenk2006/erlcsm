import Link from "next/link";
import { Button } from "@commandry/ui";
import { RobloxLinkCard } from "@/components/org/roblox-link-card";
import { requireActiveOrganization } from "@/lib/organization";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireActiveOrganization();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Workspace</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Settings</h1>
      </header>

      <section className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius-xl)] p-5">
        <div>
          <h2 className="font-medium">Permissions</h2>
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Inspect and simulate role and permission decisions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/settings/permissions">Open</Link>
        </Button>
      </section>

      <RobloxLinkCard />
    </div>
  );
}

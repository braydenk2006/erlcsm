import { notFound } from "next/navigation";
import { Badge, EmptyState } from "@commandry/ui";
import { MODULES, type ModuleKey } from "@commandry/shared";
import { hasFeature } from "@/lib/entitlements";
import { requireActiveOrganization } from "@/lib/organization";
import { navEntryForSlug } from "@/lib/nav-registry";
import { PlanRequired } from "@/components/plan-required";

const TITLES: Record<ModuleKey, string> = {
  home: "Home",
  live_server: "Live Server",
  people: "People",
  staff: "Staff",
  departments: "Departments",
  moderation: "Moderation",
  sessions: "Sessions",
  activity: "Activity",
  applications: "Applications",
  training: "Training",
  cad: "CAD",
  documents: "Documents",
  forms: "Forms",
  automations: "Automations",
  analytics: "Analytics",
  website: "Website",
  integrations: "Integrations",
  settings: "Settings",
};

const SLUG_TO_MODULE: Record<string, ModuleKey> = {
  live: "live_server",
  people: "people",
  staff: "staff",
  departments: "departments",
  moderation: "moderation",
  sessions: "sessions",
  activity: "activity",
  applications: "applications",
  training: "training",
  cad: "cad",
  documents: "documents",
  forms: "forms",
  automations: "automations",
  analytics: "analytics",
  website: "website",
  integrations: "integrations",
  settings: "settings",
};

export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  const moduleKey = SLUG_TO_MODULE[slug];
  if (!moduleKey || !MODULES.includes(moduleKey)) {
    notFound();
  }

  // Entitlement gate: if this module maps to a capability the org's plan does not
  // include, render the plan-information page instead of the feature.
  const entry = navEntryForSlug(slug);
  if (entry?.feature) {
    const { organizationId } = await requireActiveOrganization();
    if (!(await hasFeature(organizationId, entry.feature))) {
      return <PlanRequired feature={entry.feature} />;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--cmd-font-display)] text-4xl">{TITLES[moduleKey]}</h1>
        <Badge tone="warning">Foundation only</Badge>
      </div>
      <EmptyState
        title={`${TITLES[moduleKey]} domain is scaffolded`}
        description="Navigation, permissions, tenant boundaries, and documentation are in place. Domain workflows for this module will ship in the release plan without fake actions or mock production data."
      />
    </div>
  );
}

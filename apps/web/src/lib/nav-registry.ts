import type { CapabilityKey } from "@commandry/entitlements";
import type { Action } from "@commandry/permissions";

/**
 * Single source of truth for workspace navigation. Each entry declares the
 * feature (entitlement) and permission required to see it. Navigation is built
 * from this registry filtered by the org's entitlement manifest + the actor's
 * permissions — there are no per-plan hard-coded nav files.
 */
export type NavRegistryEntry = {
  key: string;
  label: string;
  href: string;
  iconName: string;
  group: "operations" | "community" | "system";
  /** Required capability, or null when always available (Home/Settings). */
  feature: CapabilityKey | null;
  /** Required permission action, or null when membership is enough. */
  permission: Action | null;
};

/** Serializable nav entry passed to the client shell. */
export type NavItem = { key: string; label: string; href: string; iconName: string };

export const NAV_REGISTRY: NavRegistryEntry[] = [
  {
    key: "home",
    label: "Home",
    href: "/app",
    iconName: "Home",
    group: "system",
    feature: null,
    permission: null,
  },
  {
    key: "live_server",
    label: "Live Server",
    href: "/app/live",
    iconName: "Radio",
    group: "operations",
    feature: "server.live_status",
    permission: "erlc:view",
  },
  {
    key: "cad",
    label: "CAD",
    href: "/app/cad",
    iconName: "Gauge",
    group: "operations",
    feature: "cad.access",
    permission: "cad.access",
  },
  {
    key: "rms",
    label: "RMS",
    href: "/app/rms",
    iconName: "FolderKanban",
    group: "operations",
    feature: null,
    permission: "rms.view",
  },
  {
    key: "people",
    label: "People",
    href: "/app/people",
    iconName: "Users",
    group: "community",
    feature: "core.members",
    permission: "member:read",
  },
  {
    key: "staff",
    label: "Staff",
    href: "/app/staff",
    iconName: "Briefcase",
    group: "community",
    feature: "core.members",
    permission: "staff:read",
  },
  {
    key: "departments",
    label: "Departments",
    href: "/app/departments",
    iconName: "Building2",
    group: "community",
    feature: "core.departments",
    permission: "department:read",
  },
  {
    key: "moderation",
    label: "Moderation",
    href: "/app/moderation",
    iconName: "Shield",
    group: "operations",
    feature: "server.moderator_calls",
    permission: "moderation:read",
  },
  {
    key: "announcements",
    label: "Announcements",
    href: "/app/announcements",
    iconName: "Megaphone",
    group: "community",
    feature: "announcements.management",
    permission: "announcement:read",
  },
  {
    key: "schedule",
    label: "Schedule",
    href: "/app/schedule",
    iconName: "CalendarClock",
    group: "operations",
    feature: "shifts.tracking",
    permission: "shifts.attendance.view",
  },
  {
    key: "sessions",
    label: "Sessions",
    href: "/app/sessions",
    iconName: "CalendarRange",
    group: "community",
    feature: "sessions.management",
    permission: "session:read",
  },
  {
    key: "activity",
    label: "Activity",
    href: "/app/activity",
    iconName: "Activity",
    group: "community",
    feature: "activity.tracking",
    permission: "activity:read",
  },
  {
    key: "applications",
    label: "Applications",
    href: "/app/applications",
    iconName: "FormInput",
    group: "community",
    feature: "applications.basic",
    permission: "application:read",
  },
  {
    key: "training",
    label: "Training",
    href: "/app/training",
    iconName: "BookOpen",
    group: "community",
    feature: "training.basic",
    permission: "training:read",
  },
  {
    key: "documents",
    label: "Documents",
    href: "/app/documents",
    iconName: "FileText",
    group: "community",
    feature: "documents.basic",
    permission: "document:read",
  },
  {
    key: "forms",
    label: "Forms",
    href: "/app/forms",
    iconName: "FormInput",
    group: "community",
    feature: "forms.basic",
    permission: null,
  },
  {
    key: "automations",
    label: "Automations",
    href: "/app/automations",
    iconName: "Workflow",
    group: "operations",
    feature: "automations.builder",
    permission: null,
  },
  {
    key: "assistant",
    label: "Ask Ordinex",
    href: "/app/assistant",
    iconName: "Bot",
    group: "operations",
    feature: null,
    permission: "ai.use",
  },
  {
    key: "knowledge",
    label: "Knowledge",
    href: "/app/knowledge",
    iconName: "Library",
    group: "community",
    feature: null,
    permission: "knowledge.view",
  },
  {
    key: "insights",
    label: "Insights",
    href: "/app/insights",
    iconName: "Sparkles",
    group: "operations",
    feature: null,
    permission: "insights.view",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/app/analytics",
    iconName: "Gauge",
    group: "operations",
    feature: "analytics.advanced",
    permission: null,
  },
  {
    key: "website",
    label: "Website",
    href: "/app/website",
    iconName: "Globe",
    group: "community",
    feature: "website.builder",
    permission: null,
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/app/integrations",
    iconName: "Link2",
    group: "system",
    feature: null,
    permission: "integrations.view",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/app/settings",
    iconName: "Settings",
    group: "system",
    feature: null,
    permission: null,
  },
];

/** Map a URL slug (from the [module] route) to its registry entry. */
export function navEntryForSlug(slug: string): NavRegistryEntry | undefined {
  const href = `/app/${slug}`;
  return NAV_REGISTRY.find((entry) => entry.href === href);
}

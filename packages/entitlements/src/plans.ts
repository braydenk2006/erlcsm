import type { CapabilityKey } from "./capabilities";
import { CONTRACT_LIMIT, type LimitKey } from "./limits";

export type PlanKey = "startup" | "growth" | "enterprise";

export type Plan = {
  key: PlanKey;
  name: string;
  /** Monthly price in USD cents. Configurable here only — never hard-coded elsewhere. */
  priceCents: number;
  interval: "month";
  contactSales: boolean;
  tagline: string;
  bestFor: string;
  recommendedFor: string[];
  cta: string;
  featureKeys: CapabilityKey[];
  limits: Record<LimitKey, number>;
};

export const PLAN_ORDER: PlanKey[] = ["startup", "growth", "enterprise"];

const GB = 1_073_741_824;

const STARTUP_FEATURES: CapabilityKey[] = [
  "core.organizations",
  "core.members",
  "core.departments",
  "core.permissions.basic",
  "core.audit.basic",
  "core.notifications",
  "core.mobile",
  "core.pwa",
  "discord.integration",
  "roblox.account_linking",
  "activity.tracking",
  "shifts.tracking",
  "sessions.management",
  "announcements.management",
  "server.live_status",
  "server.players",
  "server.teams",
  "server.locations",
  "server.callsigns",
  "server.wanted_status",
  "server.vehicles",
  "server.join_leave_logs",
  "server.kill_logs",
  "server.command_logs",
  "server.remote_commands.basic",
  "server.health_monitoring",
  "cad.access",
  "cad.dispatch.basic",
  "cad.mdt",
  "cad.people",
  "cad.vehicles",
  "cad.incident_reports",
  "cad.arrest_reports",
  "cad.citations",
  "cad.warnings",
  "cad.warrants",
  "cad.bolos",
  "cad.penal_code",
  "cad.analytics.basic",
  "applications.basic",
  "training.basic",
  "forms.basic",
  "documents.basic",
  "website.builder",
  "website.public_staff",
  "ai.report_summary",
  "ai.application_summary",
];

const GROWTH_ADDED: CapabilityKey[] = [
  "core.permissions.advanced",
  "server.remote_commands.advanced",
  "server.custom_commands",
  "server.queue_monitoring",
  "server.moderator_calls",
  "server.emergency_call_automation",
  "server.live_heatmaps",
  "server.player_history",
  "cad.dispatch.advanced",
  "cad.analytics.advanced",
  "cad.court",
  "cad.evidence",
  "cad.chain_of_custody",
  "cad.fire_ems",
  "cad.civilian_portal",
  "cad.characters",
  "cad.business_registry",
  "cad.property_registry",
  "cad.fleet",
  "cad.detective",
  "cad.multi_agency",
  "cad.unit_recommendations",
  "cad.live_unit_tracking",
  "cad.report_approvals",
  "cad.pdf_export",
  "cad.digital_signatures",
  "applications.advanced",
  "applications.interviews",
  "training.certifications",
  "forms.advanced",
  "workflows.builder",
  "automations.builder",
  "performance.reviews",
  "leave.management",
  "recognition.management",
  "documents.advanced",
  "knowledge_base",
  "website.unlimited_pages",
  "analytics.basic",
  "analytics.advanced",
  "analytics.custom_dashboards",
  "analytics.scheduled_reports",
  "ai.report_writer",
  "ai.narratives",
  "ai.search",
  "ai.analytics",
  "ai.policy_assistant",
  "ai.application_assistance",
  "ai.workflow_assistant",
  "api.public",
  "api.advanced",
  "webhooks.basic",
  "webhooks.advanced",
];

const ENTERPRISE_ADDED: CapabilityKey[] = [
  "core.audit.advanced",
  "integrations.custom",
  "enterprise.multi_organization",
  "enterprise.cross_community_staff",
  "enterprise.global_permissions",
  "enterprise.global_policies",
  "enterprise.centralized_analytics",
  "enterprise.bulk_import",
  "enterprise.bulk_export",
  "security.mfa_policy",
  "security.ip_restrictions",
  "security.custom_retention",
  "security.backup_scheduling",
  "security.disaster_recovery",
  "website.custom_domains",
  "website.white_label",
  "ai.dispatch_assistant",
  "ai.timeline_builder",
  "ai.trend_detection",
  "ai.knowledge_base",
  "support.priority",
  "support.migration",
  "support.guided_onboarding",
  "support.account_management",
  // NOTE: security.sso is intentionally NOT included — it is not implemented.
];

const GROWTH_FEATURES: CapabilityKey[] = [...STARTUP_FEATURES, ...GROWTH_ADDED];
const ENTERPRISE_FEATURES: CapabilityKey[] = [...GROWTH_FEATURES, ...ENTERPRISE_ADDED];

export const PLANS: Record<PlanKey, Plan> = {
  startup: {
    key: "startup",
    name: "Start-Up",
    priceCents: 0,
    interval: "month",
    contactSales: false,
    tagline: "Best for new and small communities",
    bestFor: "New communities, small private servers, and teams evaluating Ordinex.",
    recommendedFor: [
      "New communities",
      "Small private servers",
      "Friends running a roleplay server",
      "Communities testing Ordinex",
      "Communities with fewer than 75 members",
    ],
    cta: "Start for Free",
    featureKeys: STARTUP_FEATURES,
    limits: {
      "organizations.max": 1,
      "members.max": 75,
      "departments.max": 5,
      "storage.bytes": 2 * GB,
      "erlc_servers.max": 1,
      "discord_servers.max": 1,
      "website_pages.max": 5,
      "ai_requests.monthly": 100,
      "api_requests.monthly": 0,
      "webhooks.max": 0,
      "automations.max": 0,
      "scheduled_reports.max": 0,
      retention_days: 30,
    },
  },
  growth: {
    key: "growth",
    name: "Growth",
    priceCents: 1999,
    interval: "month",
    contactSales: false,
    tagline: "Best for active and growing communities",
    bestFor: "Growing communities needing advanced CAD, automation, and analytics.",
    recommendedFor: [
      "Active public communities",
      "Communities with multiple departments",
      "Communities requiring advanced CAD",
      "Communities wanting automation and analytics",
      "Communities managing up to 500 members",
    ],
    cta: "Choose Growth",
    featureKeys: GROWTH_FEATURES,
    limits: {
      "organizations.max": 1,
      "members.max": 500,
      "departments.max": CONTRACT_LIMIT,
      "storage.bytes": 100 * GB,
      "erlc_servers.max": 3,
      "discord_servers.max": 3,
      "website_pages.max": CONTRACT_LIMIT,
      "ai_requests.monthly": 10_000,
      "api_requests.monthly": 100_000,
      "webhooks.max": 20,
      "automations.max": 50,
      "scheduled_reports.max": 20,
      retention_days: 90,
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    priceCents: 4999,
    interval: "month",
    contactSales: true,
    tagline: "Best for large and multi-community organizations",
    bestFor: "Large or multi-community networks requiring advanced security and support.",
    recommendedFor: [
      "Large roleplay networks",
      "Multi-server communities",
      "Multi-community organizations",
      "Communities requiring advanced security",
      "Communities requiring custom support and integrations",
    ],
    cta: "Contact Ordinex",
    featureKeys: ENTERPRISE_FEATURES,
    limits: {
      "organizations.max": CONTRACT_LIMIT,
      "members.max": CONTRACT_LIMIT,
      "departments.max": CONTRACT_LIMIT,
      "storage.bytes": CONTRACT_LIMIT,
      "erlc_servers.max": CONTRACT_LIMIT,
      "discord_servers.max": CONTRACT_LIMIT,
      "website_pages.max": CONTRACT_LIMIT,
      "ai_requests.monthly": CONTRACT_LIMIT,
      "api_requests.monthly": CONTRACT_LIMIT,
      "webhooks.max": CONTRACT_LIMIT,
      "automations.max": CONTRACT_LIMIT,
      "scheduled_reports.max": CONTRACT_LIMIT,
      retention_days: 365,
    },
  },
};

export function isPlanKey(value: string): value is PlanKey {
  return value === "startup" || value === "growth" || value === "enterprise";
}

/** Lowest plan that includes a capability (used for entitlement-error messaging). */
export function requiredPlanForFeature(feature: CapabilityKey): PlanKey | null {
  for (const planKey of PLAN_ORDER) {
    if (PLANS[planKey].featureKeys.includes(feature)) return planKey;
  }
  return null;
}

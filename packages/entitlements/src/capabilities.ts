/**
 * Central capability registry for Ordinex entitlements. Every gated capability
 * in the product has exactly one key here. Plans, the entitlement manifest, the
 * public Plans page, and the verification matrix all derive from this registry —
 * there is no duplicated, hand-maintained plan feature list.
 */

export type CapabilityGroupKey =
  | "core"
  | "integrations_core"
  | "server"
  | "cad"
  | "applications"
  | "training"
  | "forms"
  | "workflows"
  | "people_ops"
  | "documents"
  | "website"
  | "analytics"
  | "ai"
  | "developer"
  | "enterprise"
  | "security"
  | "support";

export type CapabilityGroup = { key: CapabilityGroupKey; label: string };

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  { key: "core", label: "Core Platform" },
  { key: "integrations_core", label: "Community Integrations" },
  { key: "server", label: "Server Management" },
  { key: "cad", label: "CAD / MDT" },
  { key: "applications", label: "Applications" },
  { key: "training", label: "Training" },
  { key: "forms", label: "Forms" },
  { key: "workflows", label: "Workflows & Automation" },
  { key: "people_ops", label: "People Operations" },
  { key: "documents", label: "Documents" },
  { key: "website", label: "Website" },
  { key: "analytics", label: "Analytics" },
  { key: "ai", label: "AI" },
  { key: "developer", label: "Integrations & Developer Platform" },
  { key: "enterprise", label: "Enterprise Administration" },
  { key: "security", label: "Security" },
  { key: "support", label: "Support" },
];

/** capabilityKey -> { group, label }. */
const DEFS: Record<string, { group: CapabilityGroupKey; label: string }> = {
  // Core platform
  "core.organizations": { group: "core", label: "Organizations" },
  "core.members": { group: "core", label: "Members" },
  "core.departments": { group: "core", label: "Departments" },
  "core.permissions.basic": { group: "core", label: "Basic permissions" },
  "core.permissions.advanced": { group: "core", label: "Advanced permission templates" },
  "core.audit.basic": { group: "core", label: "Basic audit logs" },
  "core.audit.advanced": { group: "core", label: "Advanced audit logs & retention" },
  "core.notifications": { group: "core", label: "Notifications" },
  "core.mobile": { group: "core", label: "Mobile access" },
  "core.pwa": { group: "core", label: "Installable PWA" },
  // Community integrations
  "discord.integration": { group: "integrations_core", label: "Discord integration" },
  "roblox.account_linking": { group: "integrations_core", label: "Roblox account linking" },
  "activity.tracking": { group: "integrations_core", label: "Activity tracking" },
  "shifts.tracking": { group: "integrations_core", label: "Shift tracking" },
  "sessions.management": { group: "integrations_core", label: "Session management" },
  "announcements.management": { group: "integrations_core", label: "Announcements" },
  // Server management
  "server.live_status": { group: "server", label: "Live server status" },
  "server.players": { group: "server", label: "Current player list" },
  "server.teams": { group: "server", label: "Player teams" },
  "server.locations": { group: "server", label: "Player locations & map" },
  "server.callsigns": { group: "server", label: "Callsigns" },
  "server.wanted_status": { group: "server", label: "Wanted stars" },
  "server.vehicles": { group: "server", label: "Vehicle data" },
  "server.join_leave_logs": { group: "server", label: "Join & leave logs" },
  "server.kill_logs": { group: "server", label: "Kill logs" },
  "server.command_logs": { group: "server", label: "Command logs" },
  "server.remote_commands.basic": { group: "server", label: "Basic remote commands" },
  "server.remote_commands.advanced": { group: "server", label: "Advanced remote commands" },
  "server.queue_monitoring": { group: "server", label: "Queue monitoring" },
  "server.moderator_calls": { group: "server", label: "Moderator-call dashboard" },
  "server.emergency_call_automation": { group: "server", label: "Emergency-call automation" },
  "server.live_heatmaps": { group: "server", label: "Live heatmaps" },
  "server.health_monitoring": { group: "server", label: "ER:LC integration health" },
  "server.player_history": { group: "server", label: "Player-history correlation" },
  "server.custom_commands": { group: "server", label: "Custom in-game command builder" },
  // CAD / MDT
  "cad.access": { group: "cad", label: "CAD access" },
  "cad.dispatch.basic": { group: "cad", label: "Dispatch board" },
  "cad.dispatch.advanced": { group: "cad", label: "Advanced dispatch" },
  "cad.mdt": { group: "cad", label: "MDT" },
  "cad.people": { group: "cad", label: "Person records" },
  "cad.vehicles": { group: "cad", label: "Vehicle records" },
  "cad.incident_reports": { group: "cad", label: "Incident reports" },
  "cad.arrest_reports": { group: "cad", label: "Arrest reports" },
  "cad.citations": { group: "cad", label: "Citations" },
  "cad.warnings": { group: "cad", label: "Written warnings" },
  "cad.warrants": { group: "cad", label: "Warrants" },
  "cad.bolos": { group: "cad", label: "BOLOs" },
  "cad.penal_code": { group: "cad", label: "Penal code" },
  "cad.analytics.basic": { group: "cad", label: "Basic dispatch analytics" },
  "cad.analytics.advanced": { group: "cad", label: "Advanced dispatch analytics" },
  "cad.court": { group: "cad", label: "Court system" },
  "cad.evidence": { group: "cad", label: "Evidence locker" },
  "cad.chain_of_custody": { group: "cad", label: "Chain of custody" },
  "cad.fire_ems": { group: "cad", label: "Fire / EMS workflows" },
  "cad.civilian_portal": { group: "cad", label: "Civilian portal" },
  "cad.characters": { group: "cad", label: "Character management" },
  "cad.business_registry": { group: "cad", label: "Business registry" },
  "cad.property_registry": { group: "cad", label: "Property registry" },
  "cad.fleet": { group: "cad", label: "Fleet management" },
  "cad.detective": { group: "cad", label: "Detective case management" },
  "cad.multi_agency": { group: "cad", label: "Multi-agency dispatch" },
  "cad.unit_recommendations": { group: "cad", label: "Unit recommendations" },
  "cad.live_unit_tracking": { group: "cad", label: "Live unit tracking" },
  "cad.report_approvals": { group: "cad", label: "Report approval workflows" },
  "cad.pdf_export": { group: "cad", label: "PDF export" },
  "cad.digital_signatures": { group: "cad", label: "Digital signatures" },
  // Applications
  "applications.basic": { group: "applications", label: "Applications" },
  "applications.advanced": { group: "applications", label: "Advanced application workflows" },
  "applications.interviews": { group: "applications", label: "Interview scheduling" },
  // Training
  "training.basic": { group: "training", label: "Basic training" },
  "training.certifications": { group: "training", label: "Certification tracking" },
  // Forms
  "forms.basic": { group: "forms", label: "Basic forms" },
  "forms.advanced": { group: "forms", label: "Advanced forms" },
  // Workflows
  "workflows.builder": { group: "workflows", label: "Workflow builder" },
  "automations.builder": { group: "workflows", label: "Automation builder" },
  // People ops
  "performance.reviews": { group: "people_ops", label: "Performance reviews" },
  "leave.management": { group: "people_ops", label: "Leave requests" },
  "recognition.management": { group: "people_ops", label: "Recognition system" },
  // Documents
  "documents.basic": { group: "documents", label: "Basic document storage" },
  "documents.advanced": { group: "documents", label: "Advanced document workflows" },
  knowledge_base: { group: "documents", label: "Knowledge base" },
  // Website
  "website.builder": { group: "website", label: "Website builder" },
  "website.public_staff": { group: "website", label: "Public staff directory" },
  "website.unlimited_pages": { group: "website", label: "Unlimited website pages" },
  "website.custom_domains": { group: "website", label: "Custom domains" },
  "website.white_label": { group: "website", label: "White-label branding" },
  // Analytics
  "analytics.basic": { group: "analytics", label: "Basic analytics" },
  "analytics.advanced": { group: "analytics", label: "Advanced analytics" },
  "analytics.custom_dashboards": { group: "analytics", label: "Custom dashboards" },
  "analytics.scheduled_reports": { group: "analytics", label: "Scheduled reports" },
  // AI
  "ai.report_summary": { group: "ai", label: "AI report summaries" },
  "ai.application_summary": { group: "ai", label: "AI application summaries" },
  "ai.report_writer": { group: "ai", label: "AI report drafting" },
  "ai.narratives": { group: "ai", label: "AI narrative generation" },
  "ai.search": { group: "ai", label: "Natural-language search" },
  "ai.analytics": { group: "ai", label: "AI analytics summaries" },
  "ai.policy_assistant": { group: "ai", label: "AI policy assistant" },
  "ai.application_assistance": { group: "ai", label: "AI application assistance" },
  "ai.workflow_assistant": { group: "ai", label: "AI workflow drafting" },
  "ai.dispatch_assistant": { group: "ai", label: "AI dispatch assistant" },
  "ai.timeline_builder": { group: "ai", label: "AI case-timeline builder" },
  "ai.trend_detection": { group: "ai", label: "AI trend detection" },
  "ai.knowledge_base": { group: "ai", label: "AI knowledge-base assistance" },
  // Developer platform
  "api.public": { group: "developer", label: "Public API" },
  "api.advanced": { group: "developer", label: "Advanced API" },
  "webhooks.basic": { group: "developer", label: "Outgoing webhooks" },
  "webhooks.advanced": { group: "developer", label: "Advanced webhooks" },
  "integrations.custom": { group: "developer", label: "Custom integrations" },
  // Enterprise administration
  "enterprise.multi_organization": { group: "enterprise", label: "Multi-community management" },
  "enterprise.cross_community_staff": { group: "enterprise", label: "Cross-community staff" },
  "enterprise.global_permissions": { group: "enterprise", label: "Global permission templates" },
  "enterprise.global_policies": { group: "enterprise", label: "Global policy management" },
  "enterprise.centralized_analytics": { group: "enterprise", label: "Centralized analytics" },
  "enterprise.bulk_import": { group: "enterprise", label: "Bulk / advanced import" },
  "enterprise.bulk_export": { group: "enterprise", label: "Bulk / advanced export" },
  // Security
  "security.mfa_policy": { group: "security", label: "Mandatory MFA policy" },
  "security.ip_restrictions": { group: "security", label: "IP restrictions" },
  "security.custom_retention": { group: "security", label: "Custom data-retention policies" },
  "security.backup_scheduling": { group: "security", label: "Backup scheduling" },
  "security.disaster_recovery": { group: "security", label: "Disaster-recovery support" },
  "security.sso": { group: "security", label: "Single sign-on (SSO)" },
  // Support
  "support.priority": { group: "support", label: "Priority support" },
  "support.migration": { group: "support", label: "Migration assistance" },
  "support.guided_onboarding": { group: "support", label: "Guided onboarding" },
  "support.account_management": { group: "support", label: "Dedicated account management" },
};

export type CapabilityKey = keyof typeof DEFS;

export type Capability = { key: CapabilityKey; group: CapabilityGroupKey; label: string };

export const CAPABILITIES: Capability[] = (Object.keys(DEFS) as CapabilityKey[]).map((key) => ({
  key,
  group: DEFS[key]!.group,
  label: DEFS[key]!.label,
}));

const CAPABILITY_KEY_SET = new Set<string>(Object.keys(DEFS));

export function isCapabilityKey(value: string): value is CapabilityKey {
  return CAPABILITY_KEY_SET.has(value);
}

export function capabilityLabel(key: CapabilityKey): string {
  return DEFS[key]!.label;
}

export function capabilitiesByGroup(group: CapabilityGroupKey): Capability[] {
  return CAPABILITIES.filter((capability) => capability.group === group);
}

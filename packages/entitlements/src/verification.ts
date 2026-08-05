import { CAPABILITIES, type CapabilityKey } from "./capabilities";

/**
 * Honest, codebase-verified status for every capability. This is the single
 * source of truth the public Plans page and the verification matrix consume, so
 * a capability advertised in a plan bundle is only shown as "included" when it is
 * actually built. Missing capabilities render as "Coming Soon".
 *
 * A capability is "verified" only when it has a working UI + backend +
 * persistence + tenant isolation + permission enforcement (see
 * docs/plans/FEATURE_VERIFICATION_MATRIX.md for evidence).
 */
export type VerificationStatus = "verified" | "partial" | "missing" | "coming_soon" | "blocked";

/** Anything not listed here defaults to "missing". */
const OVERRIDES: Partial<Record<CapabilityKey, VerificationStatus>> = {
  // Core (verified)
  "core.organizations": "verified",
  "core.permissions.basic": "verified",
  "core.audit.basic": "verified",
  // Core organization management (Start-Up completion)
  "core.members": "verified",
  "core.departments": "verified",
  "core.notifications": "verified",
  "announcements.management": "verified",
  "core.mobile": "partial",
  "core.pwa": "partial",
  // Identity integration
  "roblox.account_linking": "verified",
  // Integrations core
  "discord.integration": "partial",
  // Operational Time Platform (Phase 4)
  "shifts.tracking": "verified",
  "activity.tracking": "verified",
  "sessions.management": "verified",
  // Server management (verified — ER:LC live suite)
  "server.live_status": "verified",
  "server.players": "verified",
  "server.teams": "verified",
  "server.callsigns": "verified",
  // Live PRC ER:LC API exposes no per-player coordinates or wanted level; these
  // work with the simulator but not the live integration -> Partial (not verified).
  "server.locations": "partial",
  "server.wanted_status": "partial",
  "server.vehicles": "verified",
  "server.join_leave_logs": "verified",
  "server.kill_logs": "verified",
  "server.command_logs": "verified",
  "server.remote_commands.basic": "verified",
  "server.health_monitoring": "verified",
  "server.player_history": "verified",
  // CAD (verified core)
  "cad.access": "verified",
  "cad.dispatch.basic": "verified",
  "cad.people": "verified",
  "cad.vehicles": "verified",
  "cad.citations": "verified",
  "cad.warnings": "verified",
  "cad.warrants": "verified",
  "cad.bolos": "verified",
  "cad.penal_code": "verified",
  "cad.report_approvals": "verified",
  // CAD (partial)
  "cad.mdt": "partial",
  "cad.incident_reports": "partial",
  "cad.arrest_reports": "partial",
  "cad.analytics.basic": "partial",
  "cad.multi_agency": "partial",
  // Documents (partial — basic storage schema only)
  "documents.basic": "partial",
  // Website (partial — public staff directory surface exists as scaffold)
  "website.public_staff": "partial",
  // Support commitments (operational, delivered via onboarding — not code)
  "support.priority": "coming_soon",
  "support.migration": "coming_soon",
  "support.guided_onboarding": "coming_soon",
  "support.account_management": "coming_soon",
};

export const VERIFICATION: Record<CapabilityKey, VerificationStatus> = CAPABILITIES.reduce(
  (acc, capability) => {
    acc[capability.key] = OVERRIDES[capability.key] ?? "missing";
    return acc;
  },
  {} as Record<CapabilityKey, VerificationStatus>,
);

export function verificationOf(key: CapabilityKey): VerificationStatus {
  return VERIFICATION[key] ?? "missing";
}

/** A capability is safe to advertise as "included" only when built. */
export function isAdvertisable(key: CapabilityKey): boolean {
  const status = verificationOf(key);
  return status === "verified" || status === "partial";
}

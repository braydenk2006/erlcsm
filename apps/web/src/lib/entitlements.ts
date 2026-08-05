import { cache } from "react";
import { getOrganizationManifest, computeUsage } from "@commandry/api";
import { requiredPlanForFeature, type CapabilityKey, type LimitKey } from "@commandry/entitlements";
import { EntitlementError, LimitExceededError } from "@commandry/shared";

/**
 * Load the active organization's entitlement manifest (memoized per request).
 * The manifest is the single source of truth for feature/limit gating.
 */
export const getManifest = cache(async (organizationId: string) => {
  return getOrganizationManifest(organizationId);
});

/**
 * Server-side feature gate. Throws a structured `EntitlementError` (402,
 * FEATURE_NOT_ENTITLED) when the org's plan does not include the capability.
 * The frontend is never the security boundary — call this in every protected route.
 */
export async function requireFeature(
  organizationId: string,
  feature: CapabilityKey,
): Promise<void> {
  const manifest = await getManifest(organizationId);
  if (!manifest.hasFeature(feature)) {
    throw new EntitlementError(feature, requiredPlanForFeature(feature));
  }
}

/** Non-throwing feature check for conditional rendering / nav filtering. */
export async function hasFeature(organizationId: string, feature: CapabilityKey): Promise<boolean> {
  const manifest = await getManifest(organizationId);
  return manifest.hasFeature(feature);
}

/**
 * Enforce a plan usage limit. Computes live usage and throws `LimitExceededError`
 * (402) when adding `increment` more would exceed the plan's ceiling.
 */
export async function assertWithinLimit(
  organizationId: string,
  limit: LimitKey,
  increment = 1,
): Promise<void> {
  const manifest = await getManifest(organizationId);
  const max = manifest.getLimit(limit);
  const usage = await computeUsage(organizationId, limit);
  if (usage + increment > max) {
    throw new LimitExceededError(limit, max);
  }
}

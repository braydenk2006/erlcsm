import { CAPABILITIES, type CapabilityKey } from "./capabilities";
import { LIMIT_DEFS, isUnlimited, type LimitKey } from "./limits";
import { PLANS, isPlanKey, type PlanKey } from "./plans";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "grace"
  | "scheduled_cancellation"
  | "cancelled"
  | "suspended"
  | "custom_contract";

/** States that keep the organization on its paid plan (no downgrade). */
const ENTITLED_STATES: ReadonlySet<SubscriptionStatus> = new Set([
  "active",
  "trialing",
  "past_due",
  "grace",
  "scheduled_cancellation",
  "custom_contract",
]);

export type FeatureGrant = { feature: CapabilityKey; expiresAt?: string | Date | null };

export type EntitlementOverrides = {
  features?: Partial<Record<CapabilityKey, boolean>>;
  limits?: Partial<Record<LimitKey, number>>;
};

export type AddOn = {
  features?: CapabilityKey[];
  limits?: Partial<Record<LimitKey, number>>;
};

export type SubscriptionInput = {
  planKey: string;
  status?: SubscriptionStatus;
  overrides?: EntitlementOverrides;
  grants?: FeatureGrant[];
  addOns?: AddOn[];
  now?: Date;
};

export type EntitlementManifest = {
  planKey: PlanKey;
  status: SubscriptionStatus;
  features: Record<CapabilityKey, boolean>;
  limits: Record<LimitKey, number>;
  hasFeature(feature: CapabilityKey): boolean;
  getLimit(limit: LimitKey): number;
  isWithinLimit(limit: LimitKey, currentUsage: number): boolean;
};

/** Map subscription state → the plan whose entitlements actually apply. */
export function effectivePlanKey(planKey: string, status: SubscriptionStatus): PlanKey {
  if (!ENTITLED_STATES.has(status)) return "startup";
  return isPlanKey(planKey) ? planKey : "startup";
}

function grantActive(grant: FeatureGrant, now: Date): boolean {
  if (grant.expiresAt === undefined || grant.expiresAt === null) return true;
  const expires = grant.expiresAt instanceof Date ? grant.expiresAt : new Date(grant.expiresAt);
  return expires.getTime() > now.getTime();
}

/**
 * Resolve an organization's entitlement manifest from its subscription plus any
 * overrides, temporary grants, and add-ons. This is the ONLY place plan → feature
 * mapping happens; the rest of the app depends on the manifest, never plan names.
 */
export function resolveEntitlements(input: SubscriptionInput): EntitlementManifest {
  const now = input.now ?? new Date();
  const status: SubscriptionStatus = input.status ?? "active";
  const planKey = effectivePlanKey(input.planKey, status);
  const plan = PLANS[planKey];

  const features = {} as Record<CapabilityKey, boolean>;
  for (const capability of CAPABILITIES) {
    features[capability.key] = false;
  }
  for (const key of plan.featureKeys) {
    features[key] = true;
  }
  for (const addOn of input.addOns ?? []) {
    for (const key of addOn.features ?? []) {
      features[key] = true;
    }
  }
  for (const grant of input.grants ?? []) {
    if (grantActive(grant, now)) features[grant.feature] = true;
  }
  // Org-specific overrides win last (can enable or disable a capability).
  for (const [key, value] of Object.entries(input.overrides?.features ?? {})) {
    if (key in features) features[key as CapabilityKey] = Boolean(value);
  }

  const limits = { ...plan.limits } as Record<LimitKey, number>;
  for (const addOn of input.addOns ?? []) {
    for (const [key, value] of Object.entries(addOn.limits ?? {})) {
      if (typeof value === "number") {
        limits[key as LimitKey] = Math.max(limits[key as LimitKey] ?? 0, value);
      }
    }
  }
  for (const [key, value] of Object.entries(input.overrides?.limits ?? {})) {
    if (typeof value === "number") limits[key as LimitKey] = value;
  }

  return {
    planKey,
    status,
    features,
    limits,
    hasFeature: (feature) => features[feature] === true,
    getLimit: (limit) => limits[limit] ?? 0,
    isWithinLimit: (limit, currentUsage) => {
      const max = limits[limit] ?? 0;
      if (isUnlimited(max)) return currentUsage < max; // still enforce the abuse ceiling
      return currentUsage < max;
    },
  };
}

/** Default manifest for an org with no subscription row (free Start-Up). */
export function defaultManifest(now?: Date): EntitlementManifest {
  return resolveEntitlements({ planKey: "startup", status: "active", now });
}

export const ALL_LIMIT_KEYS: LimitKey[] = LIMIT_DEFS.map((limit) => limit.key);

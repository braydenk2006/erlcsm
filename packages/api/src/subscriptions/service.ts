import { prisma } from "@commandry/database";
import {
  resolveEntitlements,
  defaultManifest,
  type EntitlementManifest,
  type SubscriptionStatus,
  type PlanKey,
  type LimitKey,
  type EntitlementOverrides,
  type FeatureGrant,
  type AddOn,
} from "@commandry/entitlements";

/**
 * Load an organization's entitlement manifest. This is the ONLY place plan state
 * is turned into features/limits; everything else depends on the manifest.
 * Organizations without a subscription row default to the free Start-Up plan.
 */
export async function getOrganizationManifest(
  organizationId: string,
): Promise<EntitlementManifest> {
  const sub = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!sub) return defaultManifest();
  return resolveEntitlements({
    planKey: sub.planKey,
    status: sub.status as SubscriptionStatus,
    overrides: (sub.overrides as EntitlementOverrides) ?? {},
    grants: (sub.grants as FeatureGrant[]) ?? [],
    addOns: (sub.addOns as AddOn[]) ?? [],
  });
}

export type SubscriptionView = {
  planKey: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
};

export async function getSubscription(organizationId: string): Promise<SubscriptionView> {
  const sub = await prisma.subscription.findUnique({ where: { organizationId } });
  return {
    planKey: sub?.planKey ?? "startup",
    status: sub?.status ?? "active",
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    trialEndsAt: sub?.trialEndsAt ?? null,
  };
}

/**
 * Set the organization's plan/status (admin/testing + eventual billing-webhook
 * reconciliation). Idempotent upsert.
 */
export async function setOrganizationSubscription(
  organizationId: string,
  input: {
    planKey: PlanKey;
    status?: SubscriptionStatus;
    overrides?: EntitlementOverrides;
    grants?: FeatureGrant[];
    addOns?: AddOn[];
    provider?: string;
    providerSubscriptionId?: string;
  },
): Promise<void> {
  const data = {
    planKey: input.planKey,
    ...(input.status ? { status: input.status } : {}),
    ...(input.overrides ? { overrides: input.overrides as object } : {}),
    ...(input.grants ? { grants: input.grants as unknown as object } : {}),
    ...(input.addOns ? { addOns: input.addOns as unknown as object } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.providerSubscriptionId
      ? { providerSubscriptionId: input.providerSubscriptionId }
      : {}),
  };
  await prisma.subscription.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
}

/** Current billing period key (UTC month). */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compute live usage for a limit. Structural limits (members/departments/servers)
 * are counted from source data; monthly-metered limits come from usage counters.
 */
export async function computeUsage(
  organizationId: string,
  limit: LimitKey,
  now = new Date(),
): Promise<number> {
  switch (limit) {
    case "members.max":
      return prisma.membership.count({ where: { organizationId, status: "ACTIVE" } });
    case "departments.max":
      return prisma.department.count({ where: { organizationId, deletedAt: null } });
    case "erlc_servers.max":
      return prisma.integrationCredential.count({ where: { organizationId, provider: "erlc" } });
    case "discord_servers.max":
      return prisma.integrationCredential.count({ where: { organizationId, provider: "discord" } });
    case "webhooks.max":
      return prisma.webhookEndpoint.count({ where: { organizationId } });
    case "ai_requests.monthly":
    case "api_requests.monthly": {
      const row = await prisma.usageCounter.findUnique({
        where: {
          organizationId_key_period: { organizationId, key: limit, period: currentPeriod(now) },
        },
      });
      return row?.value ?? 0;
    }
    default:
      return 0;
  }
}

/** Atomically increment a metered usage counter for the current period. */
export async function incrementUsage(
  organizationId: string,
  key: LimitKey,
  amount = 1,
  now = new Date(),
): Promise<number> {
  const period = currentPeriod(now);
  const row = await prisma.usageCounter.upsert({
    where: { organizationId_key_period: { organizationId, key, period } },
    create: { organizationId, key, period, value: amount },
    update: { value: { increment: amount } },
  });
  return row.value;
}

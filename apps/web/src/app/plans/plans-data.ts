import {
  CAPABILITY_GROUPS,
  PLANS,
  PLAN_ORDER,
  capabilitiesByGroup,
  formatLimit,
  verificationOf,
  LIMIT_DEFS,
  type CapabilityKey,
  type PlanKey,
} from "@commandry/entitlements";

export type CellStatus = "included" | "partial" | "soon" | "none";

/**
 * Honest comparison cell: a plan only shows a feature as included when it is
 * actually built (verified/partial). A capability listed in a plan bundle but
 * not yet implemented renders as "Coming Soon".
 */
export function cellStatus(planKey: PlanKey, feature: CapabilityKey): CellStatus {
  if (!PLANS[planKey].featureKeys.includes(feature)) return "none";
  const status = verificationOf(feature);
  if (status === "verified") return "included";
  if (status === "partial") return "partial";
  return "soon"; // missing / coming_soon / blocked → not advertised as complete
}

export type ComparisonGroup = {
  key: string;
  label: string;
  rows: { feature: CapabilityKey; label: string; cells: Record<PlanKey, CellStatus> }[];
};

export function buildComparison(): ComparisonGroup[] {
  return CAPABILITY_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    rows: capabilitiesByGroup(group.key).map((capability) => ({
      feature: capability.key,
      label: capability.label,
      cells: PLAN_ORDER.reduce(
        (acc, planKey) => {
          acc[planKey] = cellStatus(planKey, capability.key);
          return acc;
        },
        {} as Record<PlanKey, CellStatus>,
      ),
    })),
  }));
}

export function buildLimitRows(): { label: string; cells: Record<PlanKey, string> }[] {
  return LIMIT_DEFS.map((limit) => ({
    label: limit.label,
    cells: PLAN_ORDER.reduce(
      (acc, planKey) => {
        acc[planKey] = formatLimit(
          limit.key,
          PLANS[planKey].limits[limit.key],
          planKey === "enterprise",
        );
        return acc;
      },
      {} as Record<PlanKey, string>,
    ),
  }));
}

export function formatPrice(planKey: PlanKey): { amount: string; suffix: string } {
  const plan = PLANS[planKey];
  if (plan.priceCents === 0) return { amount: "Free", suffix: "" };
  const dollars = plan.priceCents / 100;
  const amount = `$${dollars.toFixed(2)}`;
  return { amount, suffix: `/ ${plan.interval}` };
}

/** Curated, verified-only highlights for a plan card (never advertises unbuilt features). */
export function cardHighlights(planKey: PlanKey): string[] {
  return PLANS[planKey].featureKeys
    .filter((key) => verificationOf(key) === "verified")
    .slice(0, 6)
    .map((key) => capabilityLabelFor(key));
}

function capabilityLabelFor(key: CapabilityKey): string {
  const group = CAPABILITY_GROUPS.find((g) =>
    capabilitiesByGroup(g.key).some((c) => c.key === key),
  );
  const capability = group ? capabilitiesByGroup(group.key).find((c) => c.key === key) : undefined;
  return capability?.label ?? key;
}

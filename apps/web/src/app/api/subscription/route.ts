import { NextResponse } from "next/server";
import { z } from "zod";
import { getSubscription, setOrganizationSubscription } from "@commandry/api";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import { PLANS, isPlanKey } from "@commandry/entitlements";
import { requirePermission } from "@/lib/cad-auth";
import { getManifest } from "@/lib/entitlements";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  planKey: z.enum(["startup", "growth", "enterprise"]),
});

/** Current subscription + the org's entitled feature keys (no private billing data). */
export async function GET() {
  try {
    const { organizationId } = await requireActiveOrganization();
    const [subscription, manifest] = await Promise.all([
      getSubscription(organizationId),
      getManifest(organizationId),
    ]);
    const entitledFeatures = Object.entries(manifest.features)
      .filter(([, on]) => on)
      .map(([key]) => key);
    return NextResponse.json({
      subscription: { planKey: subscription.planKey, status: subscription.status },
      planName: isPlanKey(subscription.planKey)
        ? PLANS[subscription.planKey].name
        : subscription.planKey,
      entitledFeatures,
      limits: manifest.limits,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Change the organization's plan (upgrade/downgrade). Requires
 * organization:manage_billing. Downgrades preserve data — the manifest simply
 * hides features that are no longer entitled. Real billing reconciliation runs
 * via provider webhooks (documented; not yet wired to a provider).
 */
export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await requirePermission("organization:manage_billing");
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A valid plan is required");
    await setOrganizationSubscription(organizationId, { planKey: parsed.data.planKey });
    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: "organization:manage_billing",
      resourceType: "subscription",
      source: "WEB",
      metadata: { planKey: parsed.data.planKey },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, planKey: parsed.data.planKey });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { buildActorForUser } from "@commandry/api";
import { authorize, type Action } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";
import { requireActiveOrganization, type ActiveOrganizationContext } from "@/lib/organization";
import { requireFeature } from "@/lib/entitlements";

/**
 * Server-side authorization for the active organization. Reuses the shared
 * Ordinex permission engine (`@commandry/permissions` via `buildActorForUser`) —
 * modules do not implement their own authorization. Throws `ForbiddenError`
 * (403) when the caller lacks the required action.
 */
export async function requirePermission(action: Action): Promise<ActiveOrganizationContext> {
  const context = await requireActiveOrganization();
  const actor = await buildActorForUser(context.userId, context.organizationId);
  const decision = authorize({ actor, organizationId: context.organizationId, action });
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason);
  }
  return context;
}

/**
 * CAD authorization: the caller's org must be entitled to `cad.access` (feature
 * gate, 402) AND the caller must hold the granular CAD action (permission, 403).
 */
export async function requireCadPermission(action: Action): Promise<ActiveOrganizationContext> {
  const context = await requirePermission(action);
  await requireFeature(context.organizationId, "cad.access");
  return context;
}

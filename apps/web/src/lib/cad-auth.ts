import { buildActorForUser } from "@commandry/api";
import { authorize, type Action } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";
import { requireActiveOrganization, type ActiveOrganizationContext } from "@/lib/organization";

/**
 * Server-side CAD authorization. Reuses the shared Ordinex permission engine
 * (`@commandry/permissions` via `buildActorForUser`) — the CAD does not implement
 * its own authorization. Throws `ForbiddenError` (403) when the caller lacks the
 * required granular `cad.*` action.
 */
export async function requireCadPermission(action: Action): Promise<ActiveOrganizationContext> {
  const context = await requireActiveOrganization();
  const actor = await buildActorForUser(context.userId, context.organizationId);
  const decision = authorize({ actor, organizationId: context.organizationId, action });
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason);
  }
  return context;
}

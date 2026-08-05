import { buildActorForUser } from "@commandry/api";
import type { Actor } from "@commandry/permissions";
import { requireActiveOrganization } from "@/lib/organization";

export type ActorContext = {
  organizationId: string;
  userId: string;
  actor: Actor;
};

/** Resolve the active org + a fully-hydrated permission actor for API routes. */
export async function requireActor(): Promise<ActorContext> {
  const { organizationId, userId } = await requireActiveOrganization();
  const actor = await buildActorForUser(userId, organizationId);
  return { organizationId, userId, actor };
}

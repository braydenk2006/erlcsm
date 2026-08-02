import type { Action } from "./actions";
import {
  SYSTEM_ROLE_PERMISSIONS,
  type Actor,
  type AuthorizationDecision,
  type AuthorizeInput,
  type Resource,
} from "./types";

function collectPermissions(actor: Actor): { permissions: Set<Action>; sources: string[] } {
  const permissions = new Set<Action>();
  const sources: string[] = [];

  for (const roleKey of actor.roleKeys) {
    const rolePerms = SYSTEM_ROLE_PERMISSIONS[roleKey];
    if (!rolePerms) continue;
    for (const permission of rolePerms) {
      permissions.add(permission);
    }
    sources.push(`role:${roleKey}`);
  }

  for (const key of actor.permissionKeys) {
    permissions.add(key as Action);
    sources.push(`grant:${key}`);
  }

  return { permissions, sources };
}

function resourceMatchesActor(
  actor: Actor,
  resource?: Resource,
): {
  ok: boolean;
  reason: string;
} {
  if (!resource) {
    return { ok: true, reason: "No resource scope required" };
  }

  if (resource.organizationId !== actor.organizationId) {
    return { ok: false, reason: "Resource belongs to a different organization" };
  }

  if (
    resource.departmentId &&
    actor.departmentIds.length > 0 &&
    !actor.departmentIds.includes(resource.departmentId) &&
    !actor.roleKeys.includes("owner") &&
    !actor.roleKeys.includes("admin")
  ) {
    // Department mismatch is only a hard deny for department-scoped checks handled by callers.
  }

  return { ok: true, reason: "Resource organization matches actor" };
}

function ownershipAllows(actor: Actor, action: Action, resource?: Resource): boolean {
  if (!resource) return false;
  const owns =
    resource.ownerUserId === actor.userId || resource.ownerMembershipId === actor.membershipId;
  if (!owns) return false;

  return (
    action.endsWith(":read") || action === "shift:manage_own" || action.endsWith(":manage_own")
  );
}

export function authorize(input: AuthorizeInput): AuthorizationDecision {
  const now = input.context?.now ?? new Date();
  const matchedGrants: string[] = [];
  const matchedRestrictions: string[] = [];

  if (input.actor.organizationId !== input.organizationId) {
    return {
      allowed: false,
      reason: "Actor is not operating within the requested organization",
      matchedGrants,
      matchedRestrictions: ["organization_mismatch"],
    };
  }

  if (input.actor.isPlatformAdmin && input.action.startsWith("platform:")) {
    matchedGrants.push("platform_admin");
    return {
      allowed: true,
      reason: "Platform administrator",
      matchedGrants,
      matchedRestrictions,
    };
  }

  const breakGlassActive =
    input.actor.breakGlassUntil != null && input.actor.breakGlassUntil.getTime() > now.getTime();

  if (input.context?.requireBreakGlass && !breakGlassActive) {
    matchedRestrictions.push("break_glass_required");
    return {
      allowed: false,
      reason: "Break-glass access is required for this action",
      matchedGrants,
      matchedRestrictions,
    };
  }

  const resourceCheck = resourceMatchesActor(input.actor, input.resource);
  if (!resourceCheck.ok) {
    matchedRestrictions.push("cross_tenant");
    return {
      allowed: false,
      reason: resourceCheck.reason,
      matchedGrants,
      matchedRestrictions,
    };
  }

  if (
    input.resource?.sensitivity === "restricted" &&
    !input.actor.permissionKeys.includes("member:view_sensitive") &&
    !input.actor.roleKeys.includes("owner") &&
    !input.actor.roleKeys.includes("admin") &&
    !breakGlassActive
  ) {
    matchedRestrictions.push("sensitive_field");
    return {
      allowed: false,
      reason: "Restricted resource requires elevated or break-glass access",
      matchedGrants,
      matchedRestrictions,
    };
  }

  const { permissions, sources } = collectPermissions(input.actor);

  if (permissions.has(input.action)) {
    matchedGrants.push(
      ...sources.filter((source) => source.includes(input.action) || source.startsWith("role:")),
    );
    return {
      allowed: true,
      reason: `Granted via ${sources[0] ?? "permission set"}`,
      matchedGrants: matchedGrants.length > 0 ? matchedGrants : sources,
      matchedRestrictions,
    };
  }

  if (ownershipAllows(input.actor, input.action, input.resource)) {
    matchedGrants.push("ownership");
    return {
      allowed: true,
      reason: "Granted via record ownership",
      matchedGrants,
      matchedRestrictions,
    };
  }

  if (breakGlassActive && input.actor.permissionKeys.includes("permission:break_glass")) {
    matchedGrants.push("break_glass");
    return {
      allowed: true,
      reason: "Granted via active break-glass session",
      matchedGrants,
      matchedRestrictions,
    };
  }

  matchedRestrictions.push("missing_permission");
  return {
    allowed: false,
    reason: `Missing permission: ${input.action}`,
    matchedGrants,
    matchedRestrictions,
  };
}

export function explainAccess(
  actor: Actor,
  action: Action,
): {
  allowed: boolean;
  why: string[];
} {
  const decision = authorize({
    actor,
    organizationId: actor.organizationId,
    action,
  });

  return {
    allowed: decision.allowed,
    why: [
      decision.reason,
      ...decision.matchedGrants.map((grant) => `grant:${grant}`),
      ...decision.matchedRestrictions.map((restriction) => `restriction:${restriction}`),
    ],
  };
}

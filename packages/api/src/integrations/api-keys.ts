import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { generateApiKey, hashApiKey, isApiScope } from "@commandry/integrations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";

function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!authorize({ actor, organizationId, action }).allowed)
    throw new ForbiddenError("Not permitted");
}

export type ApiKeyView = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

function toView(k: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}): ApiKeyView {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    status: k.status,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

export async function listApiKeys(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ApiKeyView[]> {
  requirePerm(input.actor, input.organizationId, "integrations.credentials");
  const rows = await prisma.apiKey.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Create an API key. The plaintext key is returned ONCE and never stored. */
export async function createApiKey(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date;
}): Promise<{ apiKey: ApiKeyView; plaintext: string }> {
  requirePerm(input.actor, input.organizationId, "integrations.credentials");
  if (input.name.trim().length < 2) throw new ValidationError("Name too short");
  const scopes = input.scopes.filter(isApiScope);
  if (scopes.length === 0) throw new ValidationError("At least one valid scope is required");
  const { plaintext, hashed, prefix } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: {
      publicId: createPublicId("ak"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      hashedKey: hashed,
      prefix,
      scopes,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: input.actor.userId,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.apikey.create",
    resourceType: "api_key",
    resourceId: created.id,
    source: "WEB",
    metadata: { scopes, prefix },
  }).catch(() => undefined);
  return { apiKey: toView(created), plaintext };
}

export async function revokeApiKey(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "integrations.credentials");
  const key = await prisma.apiKey.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!key) throw new NotFoundError("API key not found");
  await prisma.apiKey.update({ where: { id: key.id }, data: { status: "revoked" } });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.apikey.revoke",
    resourceType: "api_key",
    resourceId: key.id,
    source: "WEB",
  }).catch(() => undefined);
}

export type ApiKeyAuth = { organizationId: string; scopes: string[]; keyId: string };

/**
 * Authenticate an incoming API key and enforce a required scope. Tenant-bound,
 * expiry- and revocation-aware; updates last-used. Returns null when invalid.
 */
export async function authenticateApiKey(
  rawKey: string,
  requiredScope: string,
): Promise<ApiKeyAuth | null> {
  if (!rawKey || !rawKey.startsWith("ordx_")) return null;
  const key = await prisma.apiKey.findUnique({ where: { hashedKey: hashApiKey(rawKey) } });
  if (!key || key.status !== "active") return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;
  if (!key.scopes.includes(requiredScope)) return null;
  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return { organizationId: key.organizationId, scopes: key.scopes, keyId: key.id };
}

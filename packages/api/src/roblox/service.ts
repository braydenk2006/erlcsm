import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import {
  generateVerificationCode,
  getRobloxClient,
  RobloxError,
  type RobloxClient,
} from "@commandry/roblox";
import { ConflictError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";

const VERIFICATION_TTL_MS = 15 * 60 * 1000;

export type RobloxLinkView = {
  robloxUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  verifiedAt: Date;
};

export type RobloxChallengeView = {
  robloxUserId: string;
  username: string;
  displayName: string | null;
  code: string;
  expiresAt: Date;
  instructions: string;
};

export type RobloxStatus = {
  linked: RobloxLinkView | null;
  pending: RobloxChallengeView | null;
};

function instructionsFor(code: string): string {
  return `Add this exact code to your Roblox profile "About" section, then click Verify: ${code}`;
}

function mapRobloxError(error: unknown): never {
  if (error instanceof RobloxError) {
    if (error.code === "NOT_FOUND") throw new NotFoundError("No Roblox user with that username");
    if (error.code === "RATE_LIMITED")
      throw new ValidationError("Roblox is rate limiting requests. Please try again shortly.");
    throw new ValidationError("Roblox is temporarily unavailable. Please try again.");
  }
  throw error;
}

export async function getRobloxStatus(userId: string): Promise<RobloxStatus> {
  const [identity, pending] = await Promise.all([
    prisma.robloxIdentity.findUnique({ where: { userId } }),
    prisma.robloxVerification.findUnique({ where: { userId } }),
  ]);
  return {
    linked: identity
      ? {
          robloxUserId: identity.robloxUserId,
          username: identity.username,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          verifiedAt: identity.verifiedAt,
        }
      : null,
    pending:
      pending && pending.expiresAt.getTime() > Date.now()
        ? {
            robloxUserId: pending.robloxUserId,
            username: pending.username,
            displayName: pending.displayName,
            code: pending.code,
            expiresAt: pending.expiresAt,
            instructions: instructionsFor(pending.code),
          }
        : null,
  };
}

export async function startRobloxVerification(input: {
  userId: string;
  organizationId: string;
  username: string;
  client?: RobloxClient;
}): Promise<RobloxChallengeView> {
  const client = input.client ?? getRobloxClient();
  const username = input.username.trim();
  if (username.length < 3) throw new ValidationError("Enter a valid Roblox username");

  let resolved;
  try {
    resolved = await client.resolveUsername(username);
  } catch (error) {
    mapRobloxError(error);
  }

  // Early uniqueness guard: this Roblox account must not be linked elsewhere.
  const existing = await prisma.robloxIdentity.findUnique({
    where: { robloxUserId: resolved.id },
  });
  if (existing && existing.userId !== input.userId) {
    throw new ConflictError("That Roblox account is already linked to another Ordinex user");
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  await prisma.robloxVerification.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      robloxUserId: resolved.id,
      username: resolved.name,
      displayName: resolved.displayName,
      code,
      expiresAt,
    },
    update: {
      robloxUserId: resolved.id,
      username: resolved.name,
      displayName: resolved.displayName,
      code,
      expiresAt,
    },
  });

  // Mock adapter only: simulate the user placing the code in their profile so the
  // dev/test flow can complete. The live client has no such method.
  client.simulateProfileCode?.(resolved.id, code);

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "member:update",
    resourceType: "roblox_verification",
    resourceId: resolved.id,
    source: "WEB",
    metadata: { action: "start", robloxUsername: resolved.name },
  }).catch(() => undefined);

  return {
    robloxUserId: resolved.id,
    username: resolved.name,
    displayName: resolved.displayName,
    code,
    expiresAt,
    instructions: instructionsFor(code),
  };
}

export async function confirmRobloxVerification(input: {
  userId: string;
  organizationId: string;
  client?: RobloxClient;
}): Promise<RobloxLinkView> {
  const client = input.client ?? getRobloxClient();
  const pending = await prisma.robloxVerification.findUnique({ where: { userId: input.userId } });
  if (!pending) throw new NotFoundError("No pending Roblox verification. Start one first.");
  if (pending.expiresAt.getTime() <= Date.now()) {
    await prisma.robloxVerification
      .delete({ where: { userId: input.userId } })
      .catch(() => undefined);
    throw new ValidationError("Your verification code expired. Please start again.");
  }

  let profile;
  try {
    profile = await client.getUser(pending.robloxUserId);
  } catch (error) {
    mapRobloxError(error);
  }

  if (!profile.description.includes(pending.code)) {
    throw new ValidationError(
      "We couldn't find the code in your Roblox profile description yet. Save your profile and try again.",
    );
  }

  // Re-check uniqueness at confirm time (guards against races).
  const existing = await prisma.robloxIdentity.findUnique({
    where: { robloxUserId: pending.robloxUserId },
  });
  if (existing && existing.userId !== input.userId) {
    throw new ConflictError("That Roblox account is already linked to another Ordinex user");
  }

  const avatarUrl = await client.getAvatarUrl(pending.robloxUserId).catch(() => null);
  const verifiedAt = new Date();

  const identity = await prisma.robloxIdentity.upsert({
    where: { userId: input.userId },
    create: {
      publicId: createPublicId("rbx"),
      userId: input.userId,
      robloxUserId: pending.robloxUserId,
      username: profile.name || pending.username,
      displayName: profile.displayName ?? pending.displayName,
      avatarUrl,
      verifiedAt,
      lastSyncedAt: verifiedAt,
    },
    update: {
      robloxUserId: pending.robloxUserId,
      username: profile.name || pending.username,
      displayName: profile.displayName ?? pending.displayName,
      avatarUrl,
      verifiedAt,
      lastSyncedAt: verifiedAt,
    },
  });
  await prisma.robloxVerification
    .delete({ where: { userId: input.userId } })
    .catch(() => undefined);

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "member:update",
    resourceType: "roblox_identity",
    resourceId: identity.robloxUserId,
    source: "WEB",
    metadata: { action: "link", robloxUsername: identity.username },
  }).catch(() => undefined);

  return {
    robloxUserId: identity.robloxUserId,
    username: identity.username,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    verifiedAt: identity.verifiedAt,
  };
}

export async function unlinkRoblox(input: {
  userId: string;
  organizationId: string;
}): Promise<void> {
  const identity = await prisma.robloxIdentity.findUnique({ where: { userId: input.userId } });
  await prisma.robloxVerification
    .delete({ where: { userId: input.userId } })
    .catch(() => undefined);
  if (!identity) return; // idempotent; safe relink afterwards
  await prisma.robloxIdentity.delete({ where: { userId: input.userId } });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "member:update",
    resourceType: "roblox_identity",
    resourceId: identity.robloxUserId,
    source: "WEB",
    metadata: { action: "unlink" },
  }).catch(() => undefined);
}

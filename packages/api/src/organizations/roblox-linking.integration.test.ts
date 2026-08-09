import { beforeAll, describe, expect, it } from "vitest";
import { ConflictError, ValidationError, createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import { createMockRobloxClient, type RobloxClient } from "@commandry/roblox";
import { createOrganization } from "./service";
import {
  confirmRobloxVerification,
  getRobloxStatus,
  startRobloxVerification,
  unlinkRoblox,
} from "../roblox/service";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Client that resolves usernames but never reflects the code (verification fails). */
function nonReflectingClient(): RobloxClient {
  const base = createMockRobloxClient();
  return {
    mode: "mock",
    resolveUsername: base.resolveUsername,
    getUser: async (id) => ({ id, name: `u${id}`, displayName: `U ${id}`, description: "" }),
    getAvatarUrl: base.getAvatarUrl,
    // no simulateProfileCode -> start won't seed the description
  };
}

describe.skipIf(!hasDb)("roblox account linking", () => {
  let userAId = "";
  let userBId = "";
  let orgId = "";
  const uname = `Player${Date.now()}`;

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "RB A",
        email: `rba-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "RB B",
        email: `rbb-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    userAId = userA.id;
    userBId = userB.id;
    const org = await createOrganization({
      userId: userAId,
      data: { name: "RB Org", slug: `rb-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
  });

  it("starts and confirms verification via the profile-description challenge", async () => {
    const client = createMockRobloxClient(); // auto-seeds the code on start
    const challenge = await startRobloxVerification({
      userId: userAId,
      organizationId: orgId,
      username: uname,
      client,
    });
    expect(challenge.code).toMatch(/^ORDINEX-/);
    const linked = await confirmRobloxVerification({
      userId: userAId,
      organizationId: orgId,
      client,
    });
    expect(linked.username).toBe(uname);
    const status = await getRobloxStatus(userAId);
    expect(status.linked?.robloxUserId).toBe(challenge.robloxUserId);
    expect(status.pending).toBeNull();
  });

  it("prevents a second user from claiming the same Roblox account", async () => {
    const client = createMockRobloxClient();
    await expect(
      startRobloxVerification({ userId: userBId, organizationId: orgId, username: uname, client }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("fails verification when the code is not in the profile", async () => {
    const client = nonReflectingClient();
    await startRobloxVerification({
      userId: userBId,
      organizationId: orgId,
      username: `Other${Date.now()}`,
      client,
    });
    await expect(
      confirmRobloxVerification({ userId: userBId, organizationId: orgId, client }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an expired challenge", async () => {
    const client = createMockRobloxClient();
    await startRobloxVerification({
      userId: userBId,
      organizationId: orgId,
      username: `Exp${Date.now()}`,
      client,
    });
    await prisma.robloxVerification.update({
      where: { userId: userBId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      confirmRobloxVerification({ userId: userBId, organizationId: orgId, client }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("unlinks and allows safe relinking", async () => {
    await unlinkRoblox({ userId: userAId, organizationId: orgId });
    expect((await getRobloxStatus(userAId)).linked).toBeNull();
    const client = createMockRobloxClient();
    await startRobloxVerification({
      userId: userAId,
      organizationId: orgId,
      username: uname,
      client,
    });
    const relinked = await confirmRobloxVerification({
      userId: userAId,
      organizationId: orgId,
      client,
    });
    expect(relinked.username).toBe(uname);
  });
});

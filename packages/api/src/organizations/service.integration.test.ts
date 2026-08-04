import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import { createOrganization, buildActorForUser, getOrganizationForActor } from "./service";
import { ForbiddenError } from "@commandry/shared";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("organization service integration", () => {
  const emailA = `owner-a-${Date.now()}@example.com`;
  const emailB = `owner-b-${Date.now()}@example.com`;
  let userAId = "";
  let userBId = "";
  let orgAId = "";
  let orgBPublicId = "";

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Owner A",
        email: emailA,
        emailVerified: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Owner B",
        email: emailB,
        emailVerified: true,
      },
    });
    userAId = userA.id;
    userBId = userB.id;

    const orgA = await createOrganization({
      userId: userAId,
      data: {
        name: "Alpha Community",
        slug: `alpha-${Date.now()}`,
        timezone: "UTC",
      },
    });
    const orgB = await createOrganization({
      userId: userBId,
      data: {
        name: "Beta Community",
        slug: `beta-${Date.now()}`,
        timezone: "UTC",
      },
    });
    orgAId = orgA.id;
    orgBPublicId = orgB.publicId;
  });

  it("creates tenant-scoped owner memberships", async () => {
    const memberships = await prisma.membership.findMany({
      where: { userId: userAId },
      include: { roles: { include: { role: true } } },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.organizationId).toBe(orgAId);
    expect(memberships[0]?.roles.some((item) => item.role.key === "owner")).toBe(true);
  });

  it("blocks cross-tenant organization reads", async () => {
    const actorA = await buildActorForUser(userAId, orgAId);
    await expect(getOrganizationForActor(actorA, orgBPublicId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

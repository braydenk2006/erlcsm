import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId, LimitExceededError, ValidationError } from "@commandry/shared";
import { prisma } from "@commandry/database";
import { buildActorForUser, createOrganization } from "./service";
import { createDepartment, listDepartments } from "../departments/service";
import {
  createAnnouncement,
  listAnnouncements,
  publishAnnouncement,
} from "../announcements/service";
import { markAllNotificationsRead, unreadNotificationCount } from "../notifications/service";
import { listMembers, removeMember, updateMember } from "../members/service";
import type { Actor } from "@commandry/permissions";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("start-up core organization services", () => {
  let userId = "";
  let orgId = "";
  let actor: Actor;
  let membershipId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Startup Owner",
        email: `startup-${Date.now()}@example.com`,
        emailVerified: true,
      },
    });
    userId = user.id;
    const org = await createOrganization({
      userId,
      data: { name: "Startup Co", slug: `startup-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    actor = await buildActorForUser(userId, orgId);
    const membership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgId, userId },
    });
    membershipId = membership.id;
  });

  it("creates departments and enforces the Start-Up departments.max limit (5)", async () => {
    for (let i = 0; i < 5; i += 1) {
      await createDepartment({ actor, organizationId: orgId, name: `Dept ${i}` });
    }
    const list = await listDepartments({ actor, organizationId: orgId });
    expect(list.length).toBeGreaterThanOrEqual(5);
    await expect(
      createDepartment({ actor, organizationId: orgId, name: "Dept Overflow" }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });

  it("assigns a department to a member and lists members", async () => {
    const dept = await listDepartments({ actor, organizationId: orgId });
    await updateMember({
      actor,
      organizationId: orgId,
      membershipId,
      departmentIds: [dept[0]!.id],
    });
    const members = await listMembers({ actor, organizationId: orgId });
    const owner = members.find((m) => m.membershipId === membershipId);
    expect(owner?.departments.map((d) => d.id)).toContain(dept[0]!.id);
  });

  it("prevents removing yourself", async () => {
    await expect(
      removeMember({ actor, organizationId: orgId, membershipId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishes an announcement and fans out an in-app notification", async () => {
    const before = await unreadNotificationCount({ organizationId: orgId, userId });
    const { id } = await createAnnouncement({
      actor,
      organizationId: orgId,
      title: "Server maintenance",
      body: "Downtime tonight at 22:00 UTC.",
    });
    await publishAnnouncement({ actor, organizationId: orgId, announcementId: id });
    const after = await unreadNotificationCount({ organizationId: orgId, userId });
    expect(after).toBe(before + 1);

    const visible = await listAnnouncements({ actor, organizationId: orgId, userId });
    expect(visible.some((a) => a.id === id && a.status === "PUBLISHED")).toBe(true);

    const cleared = await markAllNotificationsRead({ organizationId: orgId, userId });
    expect(cleared).toBeGreaterThanOrEqual(1);
    expect(await unreadNotificationCount({ organizationId: orgId, userId })).toBe(0);
  });

  it("dedupes the announcement notification (publish is idempotent per recipient)", async () => {
    const { id } = await createAnnouncement({
      actor,
      organizationId: orgId,
      title: "Dedup test",
      body: "Body",
    });
    await publishAnnouncement({ actor, organizationId: orgId, announcementId: id });
    await publishAnnouncement({ actor, organizationId: orgId, announcementId: id });
    const count = await prisma.notification.count({
      where: { organizationId: orgId, userId, dedupeKey: `announcement:${id}` },
    });
    expect(count).toBe(1);
  });
});

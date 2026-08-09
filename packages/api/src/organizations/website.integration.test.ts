import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import { createDepartment } from "../departments/service";
import { createAnnouncement, publishAnnouncement } from "../announcements/service";
import {
  createPage,
  ensureDefaultSite,
  getPublicPage,
  getPublicSite,
  updateWebsiteSettings,
} from "../website/service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("community experience platform", () => {
  let orgId = "";
  let orgSlug = "";
  let owner: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Site Owner",
        email: `site-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    orgSlug = `site-${Date.now()}`;
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Site PD", slug: orgSlug, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
    await createDepartment({ actor: owner, organizationId: orgId, name: "Patrol Division" });
    const ann = await createAnnouncement({
      actor: owner,
      organizationId: orgId,
      title: "Welcome to the community",
      body: "We are recruiting.",
    });
    await publishAnnouncement({ actor: owner, organizationId: orgId, announcementId: ann.id });
    await ensureDefaultSite(orgId);
  });

  it("does not serve the site until it is published", async () => {
    expect(await getPublicSite(orgSlug)).toBeNull();
    expect(await getPublicPage({ orgSlug, pageSlug: "home", baseUrl: "https://x.dev" })).toBeNull();
  });

  it("dynamically synchronizes public pages with live Ordinex data", async () => {
    await updateWebsiteSettings({ actor: owner, organizationId: orgId, published: true });
    const site = await getPublicSite(orgSlug);
    expect(site).not.toBeNull();
    expect(site!.nav.some((n) => n.slug === "home")).toBe(true);

    const home = await getPublicPage({ orgSlug, pageSlug: "home", baseUrl: "https://x.dev" });
    expect(home).not.toBeNull();
    const byType = Object.fromEntries(home!.blocks.map((b) => [b.type, b.data]));

    // Announcements block reflects the published announcement (no manual re-entry).
    const news = byType.announcements as { title: string }[];
    expect(news.some((n) => n.title === "Welcome to the community")).toBe(true);
    // Departments block reflects the created department.
    const depts = byType.department_list as { name: string }[];
    expect(depts.some((d) => d.name === "Patrol Division")).toBe(true);
    // Staff directory reflects the active member — public-safe fields only.
    const staff = byType.staff_directory as Record<string, unknown>[];
    expect(staff.length).toBeGreaterThanOrEqual(1);
    expect(staff[0]!).not.toHaveProperty("email");
    // Stats resolve live counts.
    const stats = byType.stats as { label: string; value: string }[];
    expect(stats.find((s) => s.label === "Departments")?.value).toBe("1");
  });

  it("never serves a draft page publicly", async () => {
    await createPage({ actor: owner, organizationId: orgId, title: "Secret Plans" });
    expect(
      await getPublicPage({ orgSlug, pageSlug: "secret-plans", baseUrl: "https://x.dev" }),
    ).toBeNull();
  });

  it("SEO metadata + canonical are generated", async () => {
    const home = await getPublicPage({ orgSlug, pageSlug: "home", baseUrl: "https://x.dev" });
    expect(home!.meta.title).toContain("Site PD");
    expect(home!.meta.canonical).toBe(`https://x.dev/c/${orgSlug}`);
  });
});

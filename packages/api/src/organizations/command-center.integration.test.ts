import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import { createDepartment } from "../departments/service";
import { setOrganizationSubscription } from "../subscriptions/service";
import {
  getDashboard,
  resetDashboardLayout,
  saveDashboardLayout,
  searchCommandPalette,
} from "../command-center/dashboard";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("command center dashboard", () => {
  let orgId = "";
  let owner: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "CC Owner Alice",
        email: `cc-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "CC Co", slug: `cc-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
  });

  it("aggregates a full payload with a deterministic health score", async () => {
    const dash = await getDashboard({ actor: owner, organizationId: orgId });
    expect(dash.widgets.length).toBeGreaterThan(0);
    expect(dash.layout.length).toBe(dash.widgets.length);
    expect(dash.executiveSummary.length).toBeGreaterThan(0);
    const health = dash.data.community_health as {
      overall: number;
      factors: unknown[];
      severity: string;
    };
    expect(health.overall).toBeGreaterThanOrEqual(0);
    expect(health.overall).toBeLessThanOrEqual(100);
    expect(health.factors.length).toBe(11);
    // Deterministic: same inputs → same score.
    const dash2 = await getDashboard({ actor: owner, organizationId: orgId });
    expect((dash2.data.community_health as { overall: number }).overall).toBe(health.overall);
  });

  it("filters widgets by entitlement (startup hides Growth-only widgets; Growth shows them)", async () => {
    const startup = await getDashboard({ actor: owner, organizationId: orgId });
    expect(startup.widgets.find((w) => w.key === "automation_health")).toBeUndefined();
    await setOrganizationSubscription(orgId, { planKey: "growth" });
    const growth = await getDashboard({ actor: owner, organizationId: orgId });
    expect(growth.widgets.find((w) => w.key === "automation_health")).toBeDefined();
  });

  it("persists personalization (hide + reset)", async () => {
    const dash = await getDashboard({ actor: owner, organizationId: orgId });
    const hiddenLayout = dash.layout.map((l) =>
      l.key === "event_feed" ? { ...l, hidden: true } : l,
    );
    await saveDashboardLayout({ actor: owner, organizationId: orgId, layout: hiddenLayout });
    const after = await getDashboard({ actor: owner, organizationId: orgId });
    expect(after.layout.find((l) => l.key === "event_feed")?.hidden).toBe(true);
    await resetDashboardLayout({ actor: owner, organizationId: orgId });
    const reset = await getDashboard({ actor: owner, organizationId: orgId });
    expect(reset.layout.find((l) => l.key === "event_feed")?.hidden).toBe(false);
  });

  it("command palette searches members + departments (permission-aware)", async () => {
    await createDepartment({ actor: owner, organizationId: orgId, name: "K9 Division" });
    const dept = await searchCommandPalette({ actor: owner, organizationId: orgId, query: "K9" });
    expect(dept.some((r) => r.kind === "Department" && r.label.includes("K9"))).toBe(true);
    const member = await searchCommandPalette({
      actor: owner,
      organizationId: orgId,
      query: "Alice",
    });
    expect(member.some((r) => r.kind === "Member")).toBe(true);
    expect(
      await searchCommandPalette({ actor: owner, organizationId: orgId, query: "a" }),
    ).toHaveLength(0); // min length
  });

  it("isolates tenants — palette never returns another org's data", async () => {
    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other Owner",
        email: `cc-other-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other CC", slug: `cc-other-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    await createDepartment({
      actor: otherActor,
      organizationId: otherOrg.id,
      name: "Classified Ops",
    });
    const leaked = await searchCommandPalette({
      actor: owner,
      organizationId: orgId,
      query: "Classified",
    });
    expect(leaked).toHaveLength(0);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import { createDepartment } from "../departments/service";
import {
  createGoal,
  deleteGoal,
  getDepartmentInsights,
  getInsightsBundle,
  listAlerts,
  listGoals,
  updateAlertStatus,
} from "../insights/service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("insights engine", () => {
  let orgId = "";
  let owner: Actor;
  let deptId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Insight Owner",
        email: `ins-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Insight Co", slug: `ins-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
    const dept = await createDepartment({
      actor: owner,
      organizationId: orgId,
      name: "Understaffed Unit",
    });
    deptId = dept.id;
  });

  it("produces a deterministic KPI/insight bundle with evidence for every item", async () => {
    const bundle = await getInsightsBundle({ actor: owner, organizationId: orgId });
    expect(bundle.kpis.length).toBe(11);
    expect(bundle.communityHealth.overall).toBeGreaterThanOrEqual(0);
    expect(bundle.communityHealth.categories.length).toBeGreaterThan(0);
    // Determinism: a second computation yields the same health.
    const bundle2 = await getInsightsBundle({ actor: owner, organizationId: orgId });
    expect(bundle2.communityHealth.overall).toBe(bundle.communityHealth.overall);
    // Every recommendation is justified; every insight cites evidence.
    for (const r of bundle.recommendations) expect(r.reason.length).toBeGreaterThan(0);
    for (const i of bundle.insights) expect(i.evidence.length).toBeGreaterThan(0);
  });

  it("recommends and alerts on an understaffed department (backed by data)", async () => {
    const bundle = await getInsightsBundle({ actor: owner, organizationId: orgId });
    expect(bundle.recommendations.find((r) => r.kpiKey === "department_staffing")).toBeTruthy();
    expect(bundle.insights.find((i) => i.key === "insight_department_staffing")).toBeTruthy();
    const alerts = await listAlerts({ actor: owner, organizationId: orgId });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("computes historical trend from a prior KPI snapshot", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await prisma.kpiSnapshot.upsert({
      where: {
        organizationId_kpiKey_day: {
          organizationId: orgId,
          kpiKey: "community_health",
          day: yesterday,
        },
      },
      create: { organizationId: orgId, kpiKey: "community_health", day: yesterday, value: 10 },
      update: { value: 10 },
    });
    const bundle = await getInsightsBundle({ actor: owner, organizationId: orgId });
    const ch = bundle.kpis.find((k) => k.key === "community_health")!;
    expect(ch.previous).toBe(10);
    expect(["improving", "rapid_improvement"]).toContain(ch.trend.type); // current health >> 10
  });

  it("manages goals with deterministic progress + projection", async () => {
    const { id } = await createGoal({
      actor: owner,
      organizationId: orgId,
      name: "Attendance 90%",
      metricKey: "attendance_rate",
      target: 0.9,
    });
    const goals = await listGoals({ actor: owner, organizationId: orgId });
    const goal = goals.find((g) => g.id === id)!;
    expect(goal.metricKey).toBe("attendance_rate");
    expect(goal.progress).toBeGreaterThanOrEqual(0);
    expect(goal.progress).toBeLessThanOrEqual(1);
    await deleteGoal({ actor: owner, organizationId: orgId, id });
    expect(
      (await listGoals({ actor: owner, organizationId: orgId })).find((g) => g.id === id),
    ).toBeUndefined();
  });

  it("enforces alert lifecycle transitions", async () => {
    const [alert] = await listAlerts({ actor: owner, organizationId: orgId, status: "open" });
    if (alert) {
      await updateAlertStatus({
        actor: owner,
        organizationId: orgId,
        id: alert.id,
        status: "acknowledged",
      });
      const after = (await listAlerts({ actor: owner, organizationId: orgId })).find(
        (a) => a.id === alert.id,
      );
      expect(after?.status).toBe("acknowledged");
      // Illegal transition (dismissed has no exits) is rejected.
      await updateAlertStatus({
        actor: owner,
        organizationId: orgId,
        id: alert.id,
        status: "dismissed",
      });
      await expect(
        updateAlertStatus({
          actor: owner,
          organizationId: orgId,
          id: alert.id,
          status: "open" as never,
        }),
      ).rejects.toThrow();
    }
  });

  it("provides department insights and isolates tenants", async () => {
    const di = await getDepartmentInsights({
      actor: owner,
      organizationId: orgId,
      departmentId: deptId,
    });
    expect(di.understaffed).toBe(true);
    expect(di.insights.some((i) => i.title.includes("Staffing"))).toBe(true);

    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other",
        email: `ins-o-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other Ins", slug: `ins-o-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    // Cross-tenant department access is a not-found, not a leak.
    await expect(
      getDepartmentInsights({
        actor: otherActor,
        organizationId: otherOrg.id,
        departmentId: deptId,
      }),
    ).rejects.toThrow();
  });
});

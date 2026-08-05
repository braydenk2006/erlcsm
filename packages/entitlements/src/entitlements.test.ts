import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  PLANS,
  VERIFICATION,
  CONTRACT_LIMIT,
  isCapabilityKey,
  requiredPlanForFeature,
  resolveEntitlements,
  effectivePlanKey,
  isUnlimited,
} from "./index";

describe("registry consistency", () => {
  it("has unique capability keys", () => {
    const keys = CAPABILITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every plan feature key is a real capability (no orphans)", () => {
    for (const plan of Object.values(PLANS)) {
      for (const key of plan.featureKeys) {
        expect(isCapabilityKey(key)).toBe(true);
      }
    }
  });

  it("every capability has a verification status", () => {
    for (const capability of CAPABILITIES) {
      expect(VERIFICATION[capability.key]).toBeDefined();
    }
  });

  it("does not advertise SSO in any plan (not implemented)", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.featureKeys).not.toContain("security.sso");
    }
    expect(VERIFICATION["security.sso"]).toBe("missing");
  });
});

describe("plan inclusion", () => {
  it("growth includes every start-up feature", () => {
    for (const key of PLANS.startup.featureKeys) {
      expect(PLANS.growth.featureKeys).toContain(key);
    }
  });
  it("enterprise includes every growth feature", () => {
    for (const key of PLANS.growth.featureKeys) {
      expect(PLANS.enterprise.featureKeys).toContain(key);
    }
  });
  it("computes the lowest required plan for a feature", () => {
    expect(requiredPlanForFeature("cad.dispatch.basic")).toBe("startup");
    expect(requiredPlanForFeature("cad.evidence")).toBe("growth");
    expect(requiredPlanForFeature("enterprise.multi_organization")).toBe("enterprise");
  });
});

describe("manifest resolution", () => {
  it("start-up manifest has start-up features only", () => {
    const m = resolveEntitlements({ planKey: "startup" });
    expect(m.hasFeature("cad.dispatch.basic")).toBe(true);
    expect(m.hasFeature("cad.evidence")).toBe(false);
    expect(m.hasFeature("enterprise.multi_organization")).toBe(false);
    expect(m.getLimit("members.max")).toBe(75);
  });

  it("growth unlocks advanced CAD and higher limits", () => {
    const m = resolveEntitlements({ planKey: "growth" });
    expect(m.hasFeature("cad.evidence")).toBe(true);
    expect(m.getLimit("members.max")).toBe(500);
    expect(isUnlimited(m.getLimit("departments.max"))).toBe(true);
  });

  it("enterprise limits are contract-defined (finite, not Infinity)", () => {
    const m = resolveEntitlements({ planKey: "enterprise" });
    expect(m.getLimit("members.max")).toBe(CONTRACT_LIMIT);
    expect(Number.isFinite(m.getLimit("members.max"))).toBe(true);
    expect(isUnlimited(m.getLimit("members.max"))).toBe(true);
  });

  it("org overrides can disable a plan feature and set a limit", () => {
    const m = resolveEntitlements({
      planKey: "growth",
      overrides: { features: { "cad.evidence": false }, limits: { "members.max": 250 } },
    });
    expect(m.hasFeature("cad.evidence")).toBe(false);
    expect(m.getLimit("members.max")).toBe(250);
  });

  it("temporary grants unlock features until they expire", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    const active = resolveEntitlements({
      planKey: "startup",
      grants: [{ feature: "cad.evidence", expiresAt: future }],
    });
    expect(active.hasFeature("cad.evidence")).toBe(true);
    const expired = resolveEntitlements({
      planKey: "startup",
      grants: [{ feature: "cad.evidence", expiresAt: past }],
    });
    expect(expired.hasFeature("cad.evidence")).toBe(false);
  });

  it("add-ons add features and raise limits", () => {
    const m = resolveEntitlements({
      planKey: "startup",
      addOns: [{ features: ["api.public"], limits: { "members.max": 150 } }],
    });
    expect(m.hasFeature("api.public")).toBe(true);
    expect(m.getLimit("members.max")).toBe(150);
  });

  it("limit enforcement", () => {
    const m = resolveEntitlements({ planKey: "startup" });
    expect(m.isWithinLimit("members.max", 74)).toBe(true);
    expect(m.isWithinLimit("members.max", 75)).toBe(false);
  });
});

describe("subscription state → effective plan", () => {
  it("keeps the plan while active/trialing/past_due/grace", () => {
    expect(effectivePlanKey("growth", "active")).toBe("growth");
    expect(effectivePlanKey("growth", "trialing")).toBe("growth");
    expect(effectivePlanKey("growth", "past_due")).toBe("growth");
    expect(effectivePlanKey("growth", "grace")).toBe("growth");
  });
  it("falls back to Start-Up when cancelled/suspended (data preserved elsewhere)", () => {
    expect(effectivePlanKey("growth", "cancelled")).toBe("startup");
    expect(effectivePlanKey("enterprise", "suspended")).toBe("startup");
  });
});

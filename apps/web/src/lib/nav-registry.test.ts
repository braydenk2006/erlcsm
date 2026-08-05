import { describe, expect, it } from "vitest";
import { isCapabilityKey } from "@commandry/entitlements";
import { isAction } from "@commandry/permissions";
import { NAV_REGISTRY } from "./nav-registry";

describe("nav registry consistency", () => {
  it("every nav feature maps to a real capability (or is always-on)", () => {
    for (const entry of NAV_REGISTRY) {
      if (entry.feature !== null) {
        expect(isCapabilityKey(entry.feature)).toBe(true);
      }
    }
  });

  it("every nav permission maps to a real action (or is membership-only)", () => {
    for (const entry of NAV_REGISTRY) {
      if (entry.permission !== null) {
        expect(isAction(entry.permission)).toBe(true);
      }
    }
  });

  it("has unique nav keys and routes", () => {
    const keys = NAV_REGISTRY.map((e) => e.key);
    const routes = NAV_REGISTRY.map((e) => e.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

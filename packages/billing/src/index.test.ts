import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "./index";

describe("PLAN_LIMITS", () => {
  it("keeps CAD off free plan", () => {
    expect(PLAN_LIMITS.free.cadEnabled).toBe(false);
    expect(PLAN_LIMITS.pro.cadEnabled).toBe(true);
  });
});

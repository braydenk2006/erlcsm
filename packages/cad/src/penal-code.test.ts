import { describe, expect, it } from "vitest";
import { PENAL_CODE, findCharge } from "./penal-code";

describe("penal code", () => {
  it("has unique, well-formed charge codes", () => {
    const codes = new Set<string>();
    for (const charge of PENAL_CODE) {
      expect(charge.code).toMatch(/^[A-Z]-\d{3}$/);
      expect(charge.fine).toBeGreaterThanOrEqual(0);
      expect(charge.jailMinutes).toBeGreaterThanOrEqual(0);
      expect(codes.has(charge.code)).toBe(false);
      codes.add(charge.code);
    }
    expect(codes.size).toBe(PENAL_CODE.length);
  });

  it("looks up a charge by code", () => {
    expect(findCharge("F-307")?.title).toBe("Murder");
    expect(findCharge("does-not-exist")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { createPublicId, isPublicId } from "./id";

describe("createPublicId", () => {
  it("creates prefixed public ids", () => {
    const id = createPublicId("org");
    expect(id.startsWith("org_")).toBe(true);
    expect(isPublicId(id, "org")).toBe(true);
  });

  it("creates unique ids", () => {
    const a = createPublicId("usr");
    const b = createPublicId("usr");
    expect(a).not.toBe(b);
  });
});

import { describe, expect, it } from "vitest";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Liberty County RP")).toBe("liberty-county-rp");
  });
});

import { describe, expect, it } from "vitest";
import { createOrganizationSchema, organizationSlugSchema } from "./organization";

describe("organizationSlugSchema", () => {
  it("accepts valid slugs", () => {
    expect(organizationSlugSchema.parse("liberty-county")).toBe("liberty-county");
  });

  it("rejects uppercase and spaces", () => {
    expect(() => organizationSlugSchema.parse("Liberty County")).toThrow();
  });
});

describe("createOrganizationSchema", () => {
  it("applies defaults", () => {
    const parsed = createOrganizationSchema.parse({
      name: "Liberty County RP",
      slug: "liberty-county-rp",
    });
    expect(parsed.timezone).toBe("UTC");
    expect(parsed.organizationType).toBe("custom");
  });
});

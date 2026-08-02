import { describe, expect, it } from "vitest";
import { assertAuthSecret } from "./secret";

describe("assertAuthSecret", () => {
  it("requires a sufficiently long secret", () => {
    expect(() => assertAuthSecret("too-short")).toThrow(/BETTER_AUTH_SECRET/);
    expect(assertAuthSecret("test-better-auth-secret-32chars-min!!").length).toBeGreaterThanOrEqual(
      32,
    );
  });
});

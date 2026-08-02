import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./sanitize";

describe("sanitizeAuditMetadata", () => {
  it("redacts secrets from audit payloads", () => {
    const sanitized = sanitizeAuditMetadata({
      reason: "rotated key",
      apiKey: "should-not-persist",
      nested: { refreshToken: "nope" },
    }) as Record<string, unknown>;

    expect(sanitized.reason).toBe("rotated key");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).refreshToken).toBe("[REDACTED]");
  });
});

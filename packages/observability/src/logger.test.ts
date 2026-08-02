import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("redacts sensitive fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = createLogger({ requestId: "req_1" });
    log.error("failure", { apiKey: "super-secret", nested: { token: "abc" } });
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.apiKey).toBe("[REDACTED]");
    expect(payload.nested.token).toBe("[REDACTED]");
    spy.mockRestore();
  });
});

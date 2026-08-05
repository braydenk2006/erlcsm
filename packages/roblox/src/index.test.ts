import { describe, expect, it } from "vitest";
import {
  assertStableRobloxUserId,
  createMockRobloxClient,
  generateVerificationCode,
} from "./index";

describe("assertStableRobloxUserId", () => {
  it("accepts numeric ids", () => {
    expect(assertStableRobloxUserId("123456")).toBe("123456");
  });
  it("rejects usernames", () => {
    expect(() => assertStableRobloxUserId("Builderman")).toThrow();
  });
});

describe("verification code", () => {
  it("has the ORDINEX- prefix and unambiguous characters", () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^ORDINEX-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });
});

describe("mock roblox client", () => {
  it("resolves usernames deterministically and simulates the profile code", async () => {
    const client = createMockRobloxClient();
    const a = await client.resolveUsername("TestUser");
    const b = await client.resolveUsername("testuser");
    expect(a.id).toBe(b.id); // case-insensitive, stable
    const before = await client.getUser(a.id);
    expect(before.description).toBe("");
    client.simulateProfileCode?.(a.id, "ORDINEX-ABCDEFGH");
    const after = await client.getUser(a.id);
    expect(after.description).toContain("ORDINEX-ABCDEFGH");
  });
});

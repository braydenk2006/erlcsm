import { describe, expect, it } from "vitest";
import { assertStableRobloxUserId } from "./index";

describe("assertStableRobloxUserId", () => {
  it("accepts numeric ids", () => {
    expect(assertStableRobloxUserId("123456")).toBe("123456");
  });
  it("rejects usernames", () => {
    expect(() => assertStableRobloxUserId("Builderman")).toThrow();
  });
});

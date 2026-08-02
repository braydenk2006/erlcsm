import { describe, expect, it } from "vitest";
import { QUEUE_NAMES } from "./queues";

describe("QUEUE_NAMES", () => {
  it("uses stable queue identifiers", () => {
    expect(QUEUE_NAMES.system).toBe("commandry.system");
    expect(QUEUE_NAMES.moderationExpiration).toContain("moderation");
  });
});

import { describe, expect, it } from "vitest";
import { createErlcSimulator } from "./index";

describe("createErlcSimulator", () => {
  it("does not claim a live connection", async () => {
    const client = createErlcSimulator();
    const status = await client.getServerStatus();
    expect(client.mode).toBe("simulator");
    expect(status.connected).toBe(false);
  });
});

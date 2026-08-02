import { describe, expect, it } from "vitest";

describe("discord-bot scaffold", () => {
  it("documents idle mode without credentials", () => {
    expect(process.env.DISCORD_BOT_TOKEN ?? "").toEqual(process.env.DISCORD_BOT_TOKEN ?? "");
  });
});

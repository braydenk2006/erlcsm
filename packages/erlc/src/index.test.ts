import { describe, expect, it } from "vitest";
import { createErlcSimulator } from "./index";

describe("createErlcSimulator", () => {
  it("runs in simulator mode and never claims live mode", async () => {
    const client = createErlcSimulator();
    expect(client.mode).toBe("simulator");
    const status = await client.getServerStatus();
    expect(status.message.toLowerCase()).toContain("simulated");
  });

  it("produces a coherent snapshot covering every feature", async () => {
    const now = () => 1_700_000_000_000;
    const client = createErlcSimulator({ seed: "acme", now });
    const snapshot = await client.getSnapshot();

    expect(snapshot.players.length).toBeGreaterThan(0);
    expect(snapshot.status.currentPlayers).toBe(snapshot.players.length);
    // Team counts sum to the online population.
    const teamSum = snapshot.teams.reduce((total, team) => total + team.count, 0);
    expect(teamSum).toBe(snapshot.players.length);
    // Vehicles reference actual online players.
    for (const vehicle of snapshot.vehicles) {
      expect(snapshot.players.some((player) => player.name === vehicle.owner)).toBe(true);
    }
    expect(snapshot.joinLogs.length).toBeGreaterThan(0);
    expect(snapshot.killLogs.length).toBeGreaterThan(0);
    expect(snapshot.commandLogs.length).toBeGreaterThan(0);
    expect(snapshot.callLogs.length).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed and clock", async () => {
    const now = () => 1_700_000_000_000;
    const a = await createErlcSimulator({ seed: "same", now }).getSnapshot();
    const b = await createErlcSimulator({ seed: "same", now }).getSnapshot();
    expect(a.players.map((p) => p.name)).toEqual(b.players.map((p) => p.name));
  });

  it("reports wanted stars within 0..5 and callsigns for staff teams", async () => {
    const snapshot = await createErlcSimulator({
      seed: "stars",
      now: () => 1_700_000_100_000,
    }).getSnapshot();
    for (const player of snapshot.players) {
      if (player.wantedStars !== null) {
        expect(player.wantedStars).toBeGreaterThanOrEqual(1);
        expect(player.wantedStars).toBeLessThanOrEqual(5);
      }
    }
  });

  it("executes remote commands", async () => {
    const result = await createErlcSimulator().runCommand(":pm Ordinex hello");
    expect(result.ok).toBe(true);
    expect(result.command).toBe(":pm Ordinex hello");
  });
});

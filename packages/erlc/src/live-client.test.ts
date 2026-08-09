import { describe, expect, it, vi } from "vitest";
import { createLiveErlcClient } from "./live-client";
import { ErlcAuthError, ErlcOutageError, ErlcRateLimitError } from "./errors";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("createLiveErlcClient", () => {
  it("parses server status and players from the ER:LC API shape", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path.endsWith("/server")) {
        return jsonResponse({
          Name: "Test",
          OwnerId: 1,
          CurrentPlayers: 2,
          MaxPlayers: 40,
          JoinKey: "abc",
        });
      }
      if (path.endsWith("/server/players")) {
        return jsonResponse([
          { Player: "Ava:123", Permission: "Server Owner", Callsign: "1L-100", Team: "Police" },
          { Player: "Liam:456", Permission: "Normal", Team: "Civilian" },
        ]);
      }
      return jsonResponse([]);
    });

    const client = createLiveErlcClient({
      serverKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const status = await client.getServerStatus();
    expect(status.connected).toBe(true);
    expect(status.name).toBe("Test");

    const players = await client.getPlayers();
    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({
      id: 123,
      name: "Ava",
      team: "Police",
      permission: "Server Owner",
    });
    expect(players[0]?.wantedStars).toBeNull();
  });

  it("raises ErlcAuthError on 401/403", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "invalid" }, { status: 403 }));
    const client = createLiveErlcClient({
      serverKey: "bad",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.getServerStatus()).rejects.toBeInstanceOf(ErlcAuthError);
  });

  it("raises ErlcOutageError on network failure and 5xx", async () => {
    const netFail = createLiveErlcClient({
      serverKey: "k",
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    await expect(netFail.getServerStatus()).rejects.toBeInstanceOf(ErlcOutageError);

    const serverErr = createLiveErlcClient({
      serverKey: "k",
      fetchImpl: (async () => jsonResponse({}, { status: 503 })) as unknown as typeof fetch,
    });
    await expect(serverErr.getServerStatus()).rejects.toBeInstanceOf(ErlcOutageError);
  });

  it("retries once on 429 then throws ErlcRateLimitError", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse(
        { message: "slow down" },
        { status: 429, headers: { "retry-after": "0" } },
      );
    });
    const sleep = vi.fn(async () => {});
    const client = createLiveErlcClient({
      serverKey: "k",
      maxRetries: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });
    await expect(client.getServerStatus()).rejects.toBeInstanceOf(ErlcRateLimitError);
    expect(calls).toBe(2); // initial + one retry
    expect(sleep).toHaveBeenCalled();
  });

  it("ping() degrades gracefully on outage instead of throwing", async () => {
    const client = createLiveErlcClient({
      serverKey: "k",
      fetchImpl: (async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    const health = await client.ping();
    expect(health.status).toBe("degraded");
  });
});

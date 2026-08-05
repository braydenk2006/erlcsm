import {
  ErlcAuthError,
  ErlcError,
  ErlcOutageError,
  ErlcRateLimitError,
} from "./errors";
import { TokenBucket, parseRateLimitHeaders, retryAfterFromResponse } from "./rate-limit";
import type {
  ErlcCallLog,
  ErlcClient,
  ErlcCommandLog,
  ErlcHealthResult,
  ErlcJoinLeaveLog,
  ErlcKillLog,
  ErlcPlayer,
  ErlcRateLimit,
  ErlcRunCommandResult,
  ErlcServerStatus,
  ErlcSnapshot,
  ErlcTeam,
  ErlcTeamCount,
  ErlcVehicle,
} from "./types";
import { ERLC_TEAMS } from "./types";

const DEFAULT_BASE_URL = "https://api.policeroleplay.community/v1";

export type LiveClientOptions = {
  serverKey: string;
  globalKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Max automatic retries when the API returns 429. */
  maxRetries?: number;
  /** Sleep function (injectable for tests). */
  sleep?: (ms: number) => Promise<void>;
};

type FetchLike = typeof fetch;

function splitNameId(raw: unknown): { name: string; id: number | null } {
  if (typeof raw !== "string") return { name: String(raw ?? "Unknown"), id: null };
  const idx = raw.lastIndexOf(":");
  if (idx === -1) return { name: raw, id: null };
  const name = raw.slice(0, idx);
  const idPart = raw.slice(idx + 1);
  const id = Number(idPart);
  return { name: name || raw, id: Number.isFinite(id) ? id : null };
}

function normalizeTeam(raw: unknown): ErlcTeam {
  const value = String(raw ?? "").trim();
  const match = ERLC_TEAMS.find((team) => team.toLowerCase() === value.toLowerCase());
  return match ?? "Civilian";
}

function normalizePermission(raw: unknown): ErlcPlayer["permission"] {
  const value = String(raw ?? "Normal");
  if (value === "Server Owner" || value === "Server Administrator" || value === "Server Moderator") {
    return value;
  }
  return "Normal";
}

export function createLiveErlcClient(options: LiveClientOptions): ErlcClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxRetries = options.maxRetries ?? 2;

  if (!fetchImpl) {
    throw new ErlcError("No fetch implementation available", { code: "OUTAGE", retryable: true });
  }

  // PRC enforces per-key rate limits; throttle conservatively (~1 req/sec burst 5).
  const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 1, now });
  let lastRateLimit: ErlcRateLimit | null = null;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<T> {
    const wait = bucket.reserve(now());
    if (wait > 0) await sleep(wait);

    const headers = new Headers(init.headers);
    headers.set("Server-Key", options.serverKey);
    if (options.globalKey) headers.set("Authorization", options.globalKey);
    headers.set("Accept", "application/json");

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new ErlcOutageError("Unable to reach the ER:LC API", null);
    }

    lastRateLimit = parseRateLimitHeaders(response.headers);

    if (response.status === 429) {
      const retryAfter = retryAfterFromResponse(response.headers, now());
      if (attempt < maxRetries) {
        await sleep(retryAfter);
        return request<T>(path, init, attempt + 1);
      }
      throw new ErlcRateLimitError(retryAfter);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ErlcAuthError("ER:LC rejected the server key", response.status);
    }

    if (response.status >= 500) {
      throw new ErlcOutageError("The ER:LC API returned a server error", response.status);
    }

    if (!response.ok) {
      let message = `ER:LC API request failed (${response.status})`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // ignore parse failure
      }
      throw new ErlcError(message, { code: "BAD_RESPONSE", retryable: false, status: response.status });
    }

    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new ErlcError("ER:LC API returned an invalid response", {
        code: "BAD_RESPONSE",
        retryable: false,
        cause,
      });
    }
  }

  async function getServerStatus(): Promise<ErlcServerStatus> {
    const data = await request<{
      Name?: string;
      OwnerId?: number;
      CoOwnerIds?: number[];
      CurrentPlayers?: number;
      MaxPlayers?: number;
      JoinKey?: string;
      AccVerifiedReq?: string;
      TeamBalance?: boolean;
    }>("/server");
    return {
      connected: true,
      name: data.Name ?? "ER:LC Server",
      ownerId: typeof data.OwnerId === "number" ? data.OwnerId : null,
      coOwnerIds: Array.isArray(data.CoOwnerIds) ? data.CoOwnerIds : [],
      currentPlayers: data.CurrentPlayers ?? 0,
      maxPlayers: data.MaxPlayers ?? 0,
      joinKey: data.JoinKey ?? null,
      accountVerifiedReq: data.AccVerifiedReq ?? null,
      teamBalance: Boolean(data.TeamBalance),
      region: null,
      uptimeSeconds: null,
      message: "Live ER:LC connection",
    };
  }

  async function getPlayers(): Promise<ErlcPlayer[]> {
    const data = await request<
      Array<{ Player?: string; Permission?: string; Callsign?: string | null; Team?: string }>
    >("/server/players");
    return (Array.isArray(data) ? data : []).map((entry) => {
      const { name, id } = splitNameId(entry.Player);
      return {
        id: id ?? 0,
        name,
        displayName: null,
        callsign: entry.Callsign ?? null,
        team: normalizeTeam(entry.Team),
        permission: normalizePermission(entry.Permission),
        vehicle: null,
        // The ER:LC API does not expose coordinates or per-player wanted level;
        // these remain null in live mode and are surfaced as "not reported".
        wantedStars: null,
        location: { zone: null, x: null, y: null, heading: null },
      };
    });
  }

  async function getVehicles(): Promise<ErlcVehicle[]> {
    const data = await request<Array<{ Texture?: string; Name?: string; Owner?: string }>>(
      "/server/vehicles",
    );
    return (Array.isArray(data) ? data : []).map((entry) => ({
      name: entry.Name ?? "Unknown",
      owner: entry.Owner ?? "Unknown",
      ownerId: null,
      secondsOwned: null,
      texture: entry.Texture ?? null,
    }));
  }

  async function getQueue(): Promise<number[]> {
    const data = await request<number[]>("/server/queue");
    return Array.isArray(data) ? data.filter((id) => Number.isFinite(id)) : [];
  }

  async function getJoinLogs(): Promise<ErlcJoinLeaveLog[]> {
    const data = await request<Array<{ Join?: boolean; Timestamp?: number; Player?: string }>>(
      "/server/joinlogs",
    );
    return (Array.isArray(data) ? data : [])
      .map((entry) => {
        const { name, id } = splitNameId(entry.Player);
        return {
          type: entry.Join ? ("join" as const) : ("leave" as const),
          player: name,
          playerId: id,
          at: new Date((entry.Timestamp ?? 0) * 1000),
        };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  async function getKillLogs(): Promise<ErlcKillLog[]> {
    const data = await request<Array<{ Killer?: string; Killed?: string; Timestamp?: number }>>(
      "/server/killlogs",
    );
    return (Array.isArray(data) ? data : [])
      .map((entry) => {
        const killer = splitNameId(entry.Killer);
        const victim = splitNameId(entry.Killed);
        return {
          killer: killer.name,
          killerId: killer.id,
          victim: victim.name,
          victimId: victim.id,
          weapon: null,
          at: new Date((entry.Timestamp ?? 0) * 1000),
        };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  async function getCommandLogs(): Promise<ErlcCommandLog[]> {
    const data = await request<Array<{ Player?: string; Timestamp?: number; Command?: string }>>(
      "/server/commandlogs",
    );
    return (Array.isArray(data) ? data : [])
      .map((entry) => {
        const { name, id } = splitNameId(entry.Player);
        return {
          player: name,
          playerId: id,
          command: entry.Command ?? "",
          at: new Date((entry.Timestamp ?? 0) * 1000),
        };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  async function getCallLogs(): Promise<ErlcCallLog[]> {
    // The ER:LC API has no emergency-call endpoint; live 911 calls arrive via
    // verified webhooks and are merged by the integration service. The client
    // returns an empty list rather than throwing so the feature degrades cleanly.
    return [];
  }

  async function runCommand(command: string): Promise<ErlcRunCommandResult> {
    await request<unknown>("/server/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    return {
      ok: true,
      command,
      message: "Command dispatched to ER:LC",
      executedAt: new Date(now()),
    };
  }

  async function getSnapshot(): Promise<ErlcSnapshot> {
    const [status, players, vehicles, queue, joinLogs, killLogs, commandLogs, callLogs] =
      await Promise.all([
        getServerStatus(),
        getPlayers(),
        getVehicles(),
        getQueue().catch(() => [] as number[]),
        getJoinLogs().catch(() => [] as ErlcJoinLeaveLog[]),
        getKillLogs().catch(() => [] as ErlcKillLog[]),
        getCommandLogs().catch(() => [] as ErlcCommandLog[]),
        getCallLogs().catch(() => [] as ErlcCallLog[]),
      ]);
    const teams: ErlcTeamCount[] = ERLC_TEAMS.map((team) => ({
      team,
      count: players.filter((player) => player.team === team).length,
    }));
    return {
      mode: "live",
      capturedAt: new Date(now()),
      status,
      players,
      teams,
      vehicles,
      queue,
      joinLogs,
      killLogs,
      commandLogs,
      callLogs,
    };
  }

  async function ping(): Promise<ErlcHealthResult> {
    const startedAt = now();
    try {
      await getServerStatus();
      return {
        status: "connected",
        checkedAt: new Date(now()),
        latencyMs: now() - startedAt,
        message: "Live ER:LC connection healthy",
        rateLimit: lastRateLimit,
      };
    } catch (error) {
      if (error instanceof ErlcRateLimitError) {
        return {
          status: "degraded",
          checkedAt: new Date(now()),
          latencyMs: now() - startedAt,
          message: "Rate limited by the ER:LC API",
          rateLimit: lastRateLimit,
        };
      }
      if (error instanceof ErlcAuthError) {
        return {
          status: "error",
          checkedAt: new Date(now()),
          latencyMs: now() - startedAt,
          message: error.message,
          rateLimit: lastRateLimit,
        };
      }
      if (error instanceof ErlcOutageError) {
        return {
          status: "degraded",
          checkedAt: new Date(now()),
          latencyMs: now() - startedAt,
          message: "ER:LC API unavailable",
          rateLimit: lastRateLimit,
        };
      }
      return {
        status: "error",
        checkedAt: new Date(now()),
        latencyMs: now() - startedAt,
        message: error instanceof Error ? error.message : "Unknown error",
        rateLimit: lastRateLimit,
      };
    }
  }

  return {
    mode: "live",
    getServerStatus,
    getPlayers,
    getVehicles,
    getQueue,
    getJoinLogs,
    getKillLogs,
    getCommandLogs,
    getCallLogs,
    runCommand,
    getSnapshot,
    ping,
  };
}

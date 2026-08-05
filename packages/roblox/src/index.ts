/**
 * Roblox account verification uses only official, public, permitted endpoints
 * (users.roblox.com + thumbnails.roblox.com) and a profile-description challenge.
 * Passwords, auth cookies, and prohibited scraping are intentionally unsupported.
 */

export type RobloxResolvedUser = { id: string; name: string; displayName: string };
export type RobloxUser = { id: string; name: string; displayName: string; description: string };

export type RobloxErrorCode = "NOT_FOUND" | "RATE_LIMITED" | "OUTAGE" | "BAD_RESPONSE";

export class RobloxError extends Error {
  code: RobloxErrorCode;
  retryAfterMs?: number;
  constructor(message: string, code: RobloxErrorCode, retryAfterMs?: number) {
    super(message);
    this.name = "RobloxError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RobloxClient {
  mode: "live" | "mock";
  resolveUsername(username: string): Promise<RobloxResolvedUser>;
  getUser(robloxUserId: string): Promise<RobloxUser>;
  getAvatarUrl(robloxUserId: string): Promise<string | null>;
  /**
   * Dev/mock only: simulate the user placing a verification code in their Roblox
   * profile description. Undefined on the live client.
   */
  simulateProfileCode?(robloxUserId: string, code: string): void;
}

export function assertStableRobloxUserId(userId: string): string {
  if (!/^\d+$/.test(userId)) {
    throw new RobloxError("Roblox user IDs must be numeric strings", "BAD_RESPONSE");
  }
  return userId;
}

/** Generate a human-copyable, unambiguous verification code. */
export function generateVerificationCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `ORDINEX-${code}`;
}

type FetchLike = typeof fetch;

const USERS_BASE = "https://users.roblox.com/v1";
const THUMBS_BASE = "https://thumbnails.roblox.com/v1";

export function createLiveRobloxClient(
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {},
): RobloxClient {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!fetchImpl) {
    throw new RobloxError("No fetch implementation available", "OUTAGE");
  }

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      });
    } catch {
      throw new RobloxError("Unable to reach the Roblox API", "OUTAGE");
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new RobloxError(
        "Rate limited by the Roblox API",
        "RATE_LIMITED",
        Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
      );
    }
    if (response.status === 404) {
      throw new RobloxError("Roblox resource not found", "NOT_FOUND");
    }
    if (response.status >= 500) {
      throw new RobloxError("The Roblox API is unavailable", "OUTAGE");
    }
    if (!response.ok) {
      throw new RobloxError(`Roblox API request failed (${response.status})`, "BAD_RESPONSE");
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new RobloxError("Roblox API returned an invalid response", "BAD_RESPONSE");
    }
  }

  async function resolveUsername(username: string): Promise<RobloxResolvedUser> {
    const data = await request<{ data?: Array<{ id: number; name: string; displayName: string }> }>(
      `${USERS_BASE}/usernames/users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      },
    );
    const first = data.data?.[0];
    if (!first) throw new RobloxError("No Roblox user with that username", "NOT_FOUND");
    return { id: String(first.id), name: first.name, displayName: first.displayName ?? first.name };
  }

  async function getUser(robloxUserId: string): Promise<RobloxUser> {
    assertStableRobloxUserId(robloxUserId);
    const data = await request<{
      id: number;
      name: string;
      displayName: string;
      description: string;
    }>(`${USERS_BASE}/users/${robloxUserId}`);
    return {
      id: String(data.id),
      name: data.name,
      displayName: data.displayName ?? data.name,
      description: data.description ?? "",
    };
  }

  async function getAvatarUrl(robloxUserId: string): Promise<string | null> {
    try {
      const data = await request<{ data?: Array<{ imageUrl?: string; state?: string }> }>(
        `${THUMBS_BASE}/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`,
      );
      return data.data?.[0]?.imageUrl ?? null;
    } catch {
      return null; // avatar is best-effort
    }
  }

  return { mode: "live", resolveUsername, getUser, getAvatarUrl };
}

/** Deterministic in-memory client for development and tests. */
export function createMockRobloxClient(): RobloxClient {
  const descriptions = new Map<string, string>();
  const names = new Map<string, { name: string; displayName: string }>();
  const idFor = (username: string): string => {
    let hash = 0;
    for (const ch of username.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) % 1_000_000_007;
    return String(1_000_000 + hash);
  };
  return {
    mode: "mock",
    async resolveUsername(username: string) {
      const clean = username.trim();
      if (clean.length < 3) throw new RobloxError("No Roblox user with that username", "NOT_FOUND");
      const id = idFor(clean);
      names.set(id, { name: clean, displayName: clean });
      return { id, name: clean, displayName: clean };
    },
    async getUser(robloxUserId: string) {
      const known = names.get(robloxUserId);
      return {
        id: robloxUserId,
        name: known?.name ?? `mock_${robloxUserId}`,
        displayName: known?.displayName ?? `Mock ${robloxUserId}`,
        description: descriptions.get(robloxUserId) ?? "",
      };
    },
    async getAvatarUrl(robloxUserId: string) {
      return `https://mock.roblox.local/avatar/${robloxUserId}.png`;
    },
    simulateProfileCode(robloxUserId: string, code: string) {
      descriptions.set(robloxUserId, `Verifying my community with Ordinex: ${code}`);
    },
  };
}

let cached: RobloxClient | undefined;

/** Live client when ROBLOX_MODE=live, otherwise the mock adapter (dev/test). */
export function getRobloxClient(): RobloxClient {
  if (!cached) {
    cached =
      process.env.ROBLOX_MODE === "live" ? createLiveRobloxClient() : createMockRobloxClient();
  }
  return cached;
}

export type RobloxIdentityDraft = {
  robloxUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

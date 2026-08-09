/**
 * Domain types for the ER:LC (Emergency Response: Liberty County) live-server
 * integration. These model the data returned by the PRC ER:LC API and the
 * development simulator alike, so UI and services depend only on these shapes.
 */

export type ErlcMode = "simulator" | "live";

/** ER:LC in-game teams. */
export type ErlcTeam = "Civilian" | "Police" | "Sheriff" | "Fire" | "DOT" | "Jail";

export const ERLC_TEAMS: readonly ErlcTeam[] = [
  "Civilian",
  "Police",
  "Sheriff",
  "Fire",
  "DOT",
  "Jail",
];

/** In-server staff permission level as reported by the ER:LC API. */
export type ErlcPermission =
  "Normal" | "Server Moderator" | "Server Administrator" | "Server Owner";

/** Approximate world position used for the map display. */
export type ErlcLocation = {
  /** Named zone/district, when known. */
  zone: string | null;
  /** Normalized 0..1 map coordinates (x = west→east, y = north→south). */
  x: number | null;
  y: number | null;
  /** Heading in degrees (0 = north), when known. */
  heading: number | null;
};

export type ErlcPlayer = {
  id: number;
  name: string;
  displayName: string | null;
  callsign: string | null;
  team: ErlcTeam;
  permission: ErlcPermission;
  vehicle: string | null;
  /** 0–5 wanted stars; null when the player is not wanted or data is unavailable. */
  wantedStars: number | null;
  location: ErlcLocation;
};

export type ErlcServerStatus = {
  connected: boolean;
  name: string;
  ownerId: number | null;
  coOwnerIds: number[];
  currentPlayers: number;
  maxPlayers: number;
  joinKey: string | null;
  accountVerifiedReq: string | null;
  teamBalance: boolean;
  region: string | null;
  uptimeSeconds: number | null;
  message: string;
};

export type ErlcVehicle = {
  name: string;
  owner: string;
  ownerId: number | null;
  secondsOwned: number | null;
  texture: string | null;
};

export type ErlcJoinLeaveLog = {
  type: "join" | "leave";
  player: string;
  playerId: number | null;
  at: Date;
};

export type ErlcKillLog = {
  killer: string;
  killerId: number | null;
  victim: string;
  victimId: number | null;
  weapon: string | null;
  at: Date;
};

export type ErlcCommandLog = {
  player: string;
  playerId: number | null;
  command: string;
  at: Date;
};

export type ErlcCallStatus = "pending" | "active" | "closed";

/** Emergency (911) call raised in the live server. */
export type ErlcCallLog = {
  id: string;
  number: string;
  caller: string;
  callerId: number | null;
  message: string;
  location: string | null;
  status: ErlcCallStatus;
  at: Date;
};

export type ErlcTeamCount = {
  team: ErlcTeam;
  count: number;
};

export type ErlcSnapshot = {
  mode: ErlcMode;
  capturedAt: Date;
  status: ErlcServerStatus;
  players: ErlcPlayer[];
  teams: ErlcTeamCount[];
  vehicles: ErlcVehicle[];
  queue: number[];
  joinLogs: ErlcJoinLeaveLog[];
  killLogs: ErlcKillLog[];
  commandLogs: ErlcCommandLog[];
  callLogs: ErlcCallLog[];
};

export type ErlcRunCommandResult = {
  ok: boolean;
  command: string;
  message: string;
  executedAt: Date;
};

/** Rate-limit accounting parsed from ER:LC API response headers. */
export type ErlcRateLimit = {
  bucket: string | null;
  limit: number | null;
  remaining: number | null;
  resetAt: Date | null;
};

export type ErlcHealthStatus = "connected" | "degraded" | "error" | "disconnected";

export type ErlcHealthResult = {
  status: ErlcHealthStatus;
  checkedAt: Date;
  latencyMs: number | null;
  message: string;
  rateLimit: ErlcRateLimit | null;
};

/**
 * The unified client interface. Both the simulator and the live PRC client
 * implement it, so every one of the product features can be served in either
 * mode without branching in the UI.
 */
export type ErlcClient = {
  mode: ErlcMode;
  getServerStatus(): Promise<ErlcServerStatus>;
  getPlayers(): Promise<ErlcPlayer[]>;
  getVehicles(): Promise<ErlcVehicle[]>;
  getQueue(): Promise<number[]>;
  getJoinLogs(): Promise<ErlcJoinLeaveLog[]>;
  getKillLogs(): Promise<ErlcKillLog[]>;
  getCommandLogs(): Promise<ErlcCommandLog[]>;
  getCallLogs(): Promise<ErlcCallLog[]>;
  runCommand(command: string): Promise<ErlcRunCommandResult>;
  getSnapshot(): Promise<ErlcSnapshot>;
  ping(): Promise<ErlcHealthResult>;
};

import type {
  ErlcCallLog,
  ErlcClient,
  ErlcCommandLog,
  ErlcHealthResult,
  ErlcJoinLeaveLog,
  ErlcKillLog,
  ErlcPlayer,
  ErlcRunCommandResult,
  ErlcServerStatus,
  ErlcSnapshot,
  ErlcTeam,
  ErlcTeamCount,
  ErlcVehicle,
} from "./types";
import { ERLC_TEAMS } from "./types";

export type SimulatorOptions = {
  /** Stable seed so each organization gets a distinct-but-repeatable server. */
  seed?: string;
  serverName?: string;
  maxPlayers?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
};

type RosterEntry = {
  id: number;
  name: string;
  displayName: string;
  team: ErlcTeam;
  callsign: string | null;
  permission: ErlcPlayer["permission"];
};

const FIRST_NAMES = [
  "Ava",
  "Liam",
  "Noah",
  "Mia",
  "Ethan",
  "Zoe",
  "Kai",
  "Luna",
  "Owen",
  "Nova",
  "Ryder",
  "Sage",
  "Cole",
  "Iris",
  "Dane",
  "Wren",
  "Rhys",
  "Vera",
  "Jax",
  "Elle",
  "Miles",
  "Pax",
  "Reed",
  "Skye",
];
const LAST_NAMES = [
  "Hart",
  "Vance",
  "Reyes",
  "Doyle",
  "Kerr",
  "Blake",
  "Moss",
  "Frost",
  "Cross",
  "Wells",
  "Pike",
  "Lang",
  "Shaw",
  "Vaughn",
  "Rowe",
  "Sable",
  "Quinn",
  "Nash",
  "Bly",
  "Vex",
];
const ZONES = [
  "Downtown",
  "Highway 1",
  "Riverside",
  "Industrial",
  "Suburbs",
  "Airport",
  "Postal 42",
  "Mountain Pass",
  "Beachfront",
  "City Hall",
];
const VEHICLES = [
  "2020 Falcon Advance",
  "2018 Bullhorn Determinator",
  "2022 Chelston Fenwick",
  "2019 Navara Horizon",
  "2021 Averon R",
  "2016 Leland Vault",
  "2023 Surrey Sceptre",
  "Ambulance",
  "Fire Engine",
  "DOT Flatbed",
];
const WEAPONS = ["Pistol", "AR", "Shotgun", "Nightstick", "PIT Maneuver", "Sniper"];
const CALL_MESSAGES = [
  "Reckless driver on the highway",
  "Armed robbery in progress",
  "Traffic collision with injuries",
  "Structure fire reported",
  "Suspicious person near City Hall",
  "Officer requesting backup",
  "Stolen vehicle spotted",
  "Medical emergency downtown",
];

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function buildRoster(seed: number): RosterEntry[] {
  const rng = mulberry32(seed);
  const roster: RosterEntry[] = [];
  const size = 26;
  for (let i = 0; i < size; i += 1) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    // Team distribution weighted toward civilians.
    const roll = rng();
    let team: ErlcTeam;
    if (roll < 0.5) team = "Civilian";
    else if (roll < 0.68) team = "Police";
    else if (roll < 0.8) team = "Sheriff";
    else if (roll < 0.9) team = "Fire";
    else if (roll < 0.97) team = "DOT";
    else team = "Jail";

    const isStaffTeam = team !== "Civilian" && team !== "Jail";
    const unit = 100 + Math.floor(rng() * 899);
    const callsignPrefix =
      team === "Police" ? "1L" : team === "Sheriff" ? "2S" : team === "Fire" ? "M" : "D";
    const permRoll = rng();
    const permission: ErlcPlayer["permission"] =
      permRoll > 0.95
        ? "Server Owner"
        : permRoll > 0.88
          ? "Server Administrator"
          : permRoll > 0.78
            ? "Server Moderator"
            : "Normal";

    roster.push({
      id: 1_000_000 + seed * 0 + i * 7 + Math.floor(rng() * 90000),
      name: `${first}${last}${Math.floor(rng() * 90) + 10}`,
      displayName: `${first} ${last}`,
      team,
      callsign: isStaffTeam ? `${callsignPrefix}-${unit}` : null,
      permission,
    });
  }
  return roster;
}

function buildSnapshot(
  options: Required<Pick<SimulatorOptions, "seed" | "serverName" | "maxPlayers">>,
  nowMs: number,
): ErlcSnapshot {
  const baseSeed = hashSeed(options.seed);
  const roster = buildRoster(baseSeed);
  // Tick every 20 seconds so repeated reads within a refresh window agree,
  // but the roster/logs still feel alive across refreshes.
  const tick = Math.floor(nowMs / 20000);
  const rng = mulberry32((baseSeed ^ (tick * 2654435761)) >>> 0);

  const onlineCount = Math.min(roster.length, 16 + Math.floor(rng() * 12));
  const shuffled = [...roster]
    .map((entry) => ({ entry, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.entry);
  const online = shuffled.slice(0, onlineCount);

  const players: ErlcPlayer[] = online.map((entry) => {
    const inVehicle = rng() > 0.45;
    const wanted = entry.team === "Civilian" && rng() > 0.7 ? 1 + Math.floor(rng() * 5) : null;
    return {
      id: entry.id,
      name: entry.name,
      displayName: entry.displayName,
      callsign: entry.callsign,
      team: entry.team,
      permission: entry.permission,
      vehicle: inVehicle ? pick(rng, VEHICLES) : null,
      wantedStars: wanted,
      location: {
        zone: pick(rng, ZONES),
        x: Math.round(rng() * 1000) / 1000,
        y: Math.round(rng() * 1000) / 1000,
        heading: Math.floor(rng() * 360),
      },
    };
  });

  const teams: ErlcTeamCount[] = ERLC_TEAMS.map((team) => ({
    team,
    count: players.filter((player) => player.team === team).length,
  }));

  const vehicles: ErlcVehicle[] = players
    .filter((player) => player.vehicle !== null)
    .map((player) => ({
      name: player.vehicle as string,
      owner: player.name,
      ownerId: player.id,
      secondsOwned: 30 + Math.floor(rng() * 3600),
      texture: player.team === "Civilian" ? null : player.team,
    }));

  const queueSize = Math.floor(rng() * 5);
  const queue: number[] = shuffled
    .slice(onlineCount, onlineCount + queueSize)
    .map((entry) => entry.id);

  const joinLogs: ErlcJoinLeaveLog[] = [];
  for (let i = 0; i < 12; i += 1) {
    const entry = pick(rng, roster);
    joinLogs.push({
      type: rng() > 0.5 ? "join" : "leave",
      player: entry.name,
      playerId: entry.id,
      at: new Date(nowMs - i * 45000 - Math.floor(rng() * 20000)),
    });
  }

  const staff = players.filter((player) => player.permission !== "Normal");
  const commandLogs: ErlcCommandLog[] = [];
  const COMMANDS = [
    ":pm",
    ":m",
    ":kick",
    ":ban",
    ":tp",
    ":wanted",
    ":jail",
    ":refresh",
    ":weather",
  ];
  for (let i = 0; i < 8; i += 1) {
    const author = staff.length > 0 ? pick(rng, staff) : pick(rng, players);
    commandLogs.push({
      player: author.name,
      playerId: author.id,
      command: `${pick(rng, COMMANDS)} ${pick(rng, FIRST_NAMES)}`,
      at: new Date(nowMs - i * 60000 - Math.floor(rng() * 30000)),
    });
  }

  const killLogs: ErlcKillLog[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = pick(rng, players);
    let b = pick(rng, players);
    if (b.id === a.id) b = pick(rng, roster) as unknown as ErlcPlayer;
    killLogs.push({
      killer: a.name,
      killerId: a.id,
      victim: b.name,
      victimId: b.id ?? null,
      weapon: pick(rng, WEAPONS),
      at: new Date(nowMs - i * 90000 - Math.floor(rng() * 40000)),
    });
  }

  const callLogs: ErlcCallLog[] = [];
  const callCount = 3 + Math.floor(rng() * 4);
  const statuses: ErlcCallLog["status"][] = ["pending", "active", "closed"];
  for (let i = 0; i < callCount; i += 1) {
    const caller = pick(rng, players);
    callLogs.push({
      id: `sim-call-${tick}-${i}`,
      number: "911",
      caller: caller.name,
      callerId: caller.id,
      message: pick(rng, CALL_MESSAGES),
      location: pick(rng, ZONES),
      status: i === 0 ? "active" : pick(rng, statuses),
      at: new Date(nowMs - i * 120000 - Math.floor(rng() * 60000)),
    });
  }

  const status: ErlcServerStatus = {
    connected: true,
    name: options.serverName,
    ownerId: roster[0]?.id ?? null,
    coOwnerIds: roster.slice(1, 3).map((entry) => entry.id),
    currentPlayers: players.length,
    maxPlayers: options.maxPlayers,
    joinKey: "SIM-" + options.seed.slice(0, 6).toUpperCase(),
    accountVerifiedReq: "Disabled",
    teamBalance: true,
    region: "US-East (simulated)",
    uptimeSeconds: 3600 + (tick % 720) * 20,
    message: "Simulated ER:LC server — development mode, not a live connection.",
  };

  return {
    mode: "simulator",
    capturedAt: new Date(nowMs),
    status,
    players,
    teams,
    vehicles,
    queue,
    joinLogs: joinLogs.sort((a, b) => b.at.getTime() - a.at.getTime()),
    killLogs: killLogs.sort((a, b) => b.at.getTime() - a.at.getTime()),
    commandLogs: commandLogs.sort((a, b) => b.at.getTime() - a.at.getTime()),
    callLogs: callLogs.sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}

/**
 * Development simulator. Produces a coherent, lively ER:LC server so every
 * feature can be exercised without a live server key. It is always explicitly
 * labelled as simulator mode and never claims to be a production connection.
 */
export function createErlcSimulator(options: SimulatorOptions = {}): ErlcClient {
  const resolved = {
    seed: options.seed ?? "ordinex-simulator",
    serverName: options.serverName ?? "Ordinex Training Server [SIM]",
    maxPlayers: options.maxPlayers ?? 40,
  };
  const now = options.now ?? Date.now;
  const snapshot = () => buildSnapshot(resolved, now());

  return {
    mode: "simulator",
    async getServerStatus() {
      return snapshot().status;
    },
    async getPlayers() {
      return snapshot().players;
    },
    async getVehicles() {
      return snapshot().vehicles;
    },
    async getQueue() {
      return snapshot().queue;
    },
    async getJoinLogs() {
      return snapshot().joinLogs;
    },
    async getKillLogs() {
      return snapshot().killLogs;
    },
    async getCommandLogs() {
      return snapshot().commandLogs;
    },
    async getCallLogs() {
      return snapshot().callLogs;
    },
    async runCommand(command: string): Promise<ErlcRunCommandResult> {
      return {
        ok: true,
        command,
        message: `Simulated execution of "${command}". In live mode this is dispatched to ER:LC.`,
        executedAt: new Date(now()),
      };
    },
    async getSnapshot() {
      return snapshot();
    },
    async ping(): Promise<ErlcHealthResult> {
      return {
        status: "connected",
        checkedAt: new Date(now()),
        latencyMs: 4,
        message: "Simulator healthy",
        rateLimit: null,
      };
    },
  };
}

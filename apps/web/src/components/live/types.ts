// Client-side view of the /api/erlc/snapshot payload. Dates arrive as ISO
// strings over JSON, so timestamp fields are typed as string here.

export type PlayerView = {
  id: number;
  name: string;
  displayName: string | null;
  callsign: string | null;
  team: string;
  permission: string;
  vehicle: string | null;
  wantedStars: number | null;
  location: { zone: string | null; x: number | null; y: number | null; heading: number | null };
};

export type LogView = { at: string };

export type SnapshotView = {
  mode: "simulator" | "live";
  capturedAt: string;
  status: {
    connected: boolean;
    name: string;
    currentPlayers: number;
    maxPlayers: number;
    joinKey: string | null;
    region: string | null;
    uptimeSeconds: number | null;
    teamBalance: boolean;
    message: string;
  };
  players: PlayerView[];
  teams: { team: string; count: number }[];
  vehicles: { name: string; owner: string; texture: string | null; secondsOwned: number | null }[];
  queue: number[];
  joinLogs: { type: "join" | "leave"; player: string; at: string }[];
  killLogs: { killer: string; victim: string; weapon: string | null; at: string }[];
  commandLogs: { player: string; command: string; at: string }[];
  callLogs: {
    id: string;
    number: string;
    caller: string;
    message: string;
    location: string | null;
    status: string;
    at: string;
  }[];
};

export type SnapshotResponse = {
  ok: boolean;
  mode: "simulator" | "live";
  hasCredentials: boolean;
  integration: {
    status: string;
    mode: string;
    hasCredentials: boolean;
    webhookConfigured: boolean;
    lastError: string | null;
  };
  snapshot: SnapshotView | null;
  outage?: { message: string };
};

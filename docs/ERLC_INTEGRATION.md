# ER:LC integration

Package: `@commandry/erlc` (client/transport) + `@commandry/integrations` (org-aware service).

## Status

The ER:LC live-server surface is implemented end to end and driven by a rich
development **simulator** so it works without external credentials. A real
**live client** for the PRC ER:LC API (`api.policeroleplay.community/v1`) is also
implemented and is selected when `ERLC_MODE=live` and encrypted credentials are
connected. The simulator is always explicitly labelled as simulator mode and
never claims to be a production connection.

## Client interface

`ErlcClient` (implemented by both the simulator and the live client):

```ts
type ErlcClient = {
  mode: "simulator" | "live";
  getServerStatus(): Promise<ErlcServerStatus>;
  getPlayers(): Promise<ErlcPlayer[]>; // team, callsign, permission, vehicle, wantedStars, location
  getVehicles(): Promise<ErlcVehicle[]>;
  getQueue(): Promise<number[]>;
  getJoinLogs(): Promise<ErlcJoinLeaveLog[]>;
  getKillLogs(): Promise<ErlcKillLog[]>;
  getCommandLogs(): Promise<ErlcCommandLog[]>;
  getCallLogs(): Promise<ErlcCallLog[]>; // emergency (911) calls
  runCommand(command: string): Promise<ErlcRunCommandResult>;
  getSnapshot(): Promise<ErlcSnapshot>; // aggregate of all of the above
  ping(): Promise<ErlcHealthResult>; // integration-health check
};
```

- `createErlcSimulator({ seed })` — per-org deterministic-but-lively server.
- `createLiveErlcClient({ serverKey, globalKey? })` — PRC API client.
- `createErlcClient({ mode, ... })` — factory used by the service layer.

### Feature coverage

Live server status · current player list · player teams · player locations +
map display · callsigns · wanted stars · vehicles · join/leave logs · kill logs
· command logs · remote server commands · emergency-call integration · CAD
synchronization · player-history correlation.

Note: the PRC API does not expose per-player coordinates, wanted level, or a 911
endpoint. In live mode those fields are surfaced as "not reported" and emergency
calls arrive via verified webhooks; the simulator populates them fully.

## Reliability

- **Rate-limit handling** — a token bucket throttles outbound calls; `X-RateLimit-*`
  headers are parsed and 429s trigger bounded retries before raising `ErlcRateLimitError`.
- **Graceful outage handling** — network failures and 5xx map to `ErlcOutageError`;
  the snapshot API returns a typed `outage` payload so the dashboard degrades
  instead of erroring, and health checks report `degraded`/`error`.
- **Webhook verification** — inbound ER:LC/CAD webhooks are HMAC-SHA256 verified
  (constant-time) against the org's stored webhook secret before any write.

## Configuration

| Env         | Values                | Default     |
| ----------- | --------------------- | ----------- |
| `ERLC_MODE` | `simulator` \| `live` | `simulator` |

Setting `ERLC_MODE=live` uses the live client only when encrypted credentials
are connected for the organization; otherwise it falls back to the simulator.

## Encryption

Tenant ER:LC keys are stored on `IntegrationCredential` (`provider: "erlc"`)
using `@commandry/database` AES-256-GCM helpers (`encryptSecret`/`decryptSecret`):

- `ciphertext`, `iv`, `authTag`; key material from `CREDENTIALS_ENCRYPTION_KEY`
- Never logged or written into audit metadata (redaction covers api_key/token/secret)

## Service layer (`@commandry/integrations`)

- `connectErlc` / `disconnectErlc` / `getErlcIntegration`
- `getErlcClientForOrganization` — resolves live-or-simulator client for an org
- `checkErlcHealth` — integration-health monitoring (persists status/last error)
- `syncCadFromErlc` — CAD synchronization (emergency calls → `CadCall`)
- `correlatePlayerHistory` — player-history correlation (`ErlcPlayerSession` +
  Roblox identity linkage)
- `recordErlcCallWebhook` — verify + record inbound 911/CAD webhooks

## Permissions

- `erlc:view` — observe server status / roster surfaces
- `erlc:command` — privileged live commands
- `erlc:manage` — credential and integration settings

## Background jobs

The worker runs an `erlc.maintenance` job (queue `commandry.integrations`) on a
60s cadence: health checks, CAD sync, and player-history correlation for every
org with connected credentials.

When integrating the live API, cite the official PRC ER:LC API documentation.

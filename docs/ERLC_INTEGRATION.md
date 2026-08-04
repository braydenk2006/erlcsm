# ER:LC integration

Package: `@commandry/erlc`.

## Status

Release 5 will deliver live ER:LC connectivity. **Today only a simulator client exists.** No production ER:LC HTTP endpoints are invented or called.

## Interface

```ts
export type ErlcMode = "simulator" | "live";

export type ErlcClient = {
  mode: ErlcMode;
  getServerStatus(): Promise<{
    connected: boolean;
    players?: number;
    message: string;
  }>;
};
```

`createErlcSimulator()` returns `mode: "simulator"` and:

```ts
{
  connected: false,
  message: "ER:LC simulator mode active. Connect encrypted credentials to enable live mode."
}
```

## Configuration

| Env         | Values                | Default     |
| ----------- | --------------------- | ----------- |
| `ERLC_MODE` | `simulator` \| `live` | `simulator` |

`live` mode must not be treated as functional until a real client implementation and encrypted tenant credentials are wired. Setting the env alone does not create a live connection.

## Encryption

Tenant ER:LC API keys will be stored on `IntegrationCredential` (`provider: "erlc"`) using `@commandry/database` AES-256-GCM helpers:

- `ciphertext`, `iv`, `authTag`
- Key material from `CREDENTIALS_ENCRYPTION_KEY`
- Never logged or written into audit metadata (redaction patterns cover api_key/token/secret)

## Permissions

Reserved actions:

- `erlc:view` — observe server status / roster surfaces
- `erlc:command` — privileged live commands
- `erlc:manage` — credential and integration settings

System roles map these appropriately (owner/admin include command/manage; staff/moderator typically view-only). Enforcement will wrap every live call when the client lands.

## Simulator mode rules

1. Never claim `connected: true` without a verified live client response.
2. Do not fabricate player counts, bans, or command results for UI demos.
3. Live Server module pages remain foundation placeholders until R5.
4. Tests assert simulator messaging — not mock production success.

## Planned (not implemented)

- Live `ErlcClient` against the official/permitted ER:LC API surface only
- Credential connect/disconnect UI under Integrations
- Worker queue `commandry.integrations` for polling / retries
- Command allowlists, rate limits, and full audit of every live mutation
- Discord bridging of live events (with R5 Discord work)

When documenting external API paths in future PRs, cite the real vendor documentation — do not invent routes here.

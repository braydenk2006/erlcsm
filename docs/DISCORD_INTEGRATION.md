# Discord integration

Packages/apps: `@commandry/discord`, `@commandry/auth` (OAuth), `apps/discord-bot`.

## Status

| Capability                         | State                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Discord OAuth sign-in              | Wired in Better Auth **when** `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET` are set |
| Discord identity table             | Schema ready (`DiscordIdentity`)                                                    |
| Bot runtime                        | Scaffold only; idle without `DISCORD_BOT_TOKEN`                                     |
| Slash commands / guild sync        | Planned Release 5                                                                   |
| Interaction signature verification | Planned (see below)                                                                 |

## OAuth

`createAuth()` conditionally registers the Discord social provider. Without both client id and secret, Discord is omitted from social providers — magic link remains available.

OAuth callbacks are handled by Better Auth under `/api/auth/*`. Linking into `DiscordIdentity` for community verification (beyond login) is a later identity milestone.

## Setup status helper

```ts
getDiscordSetupStatus({
  clientId,
  clientSecret,
  botToken,
});
// → { oauthConfigured, botConfigured, status: "disconnected" | "degraded" | "connected" }
```

Today, presence of either OAuth or bot credentials reports `degraded` (partial setup), never a false “fully connected product” claim. Full `connected` semantics arrive with a verified runtime.

## Bot scaffold

`apps/discord-bot`:

- Without `DISCORD_BOT_TOKEN`: logs idle mode and returns (does not claim a live Discord connection).
- With token: logs that the full slash-command runtime ships in Release 5 — it does not yet connect a Discord gateway client.

## Signature verification plans

Before accepting Discord Interactions HTTP requests:

1. Verify `X-Signature-Ed25519` + `X-Signature-Timestamp` with the application public key (official Discord verification).
2. Reject expired timestamps / replays.
3. Respond to ping challenges correctly.
4. Authorize Commandry-side actions through `authorize()` using the linked membership — never trust Discord role names alone without a sync policy.
5. Audit mutations with `source: DISCORD`.

Inbound webhooks/interactions are **not** mounted in the web app yet.

## Credential storage

Guild bot tokens / integration secrets for tenants will use `IntegrationCredential` encryption (same AES-GCM path as ER:LC). The process-level `DISCORD_BOT_TOKEN` is for the platform bot runtime, not per-tenant ciphertext.

## Rank mapping

`Rank.discordRoleId` is reserved for future Discord ↔ Commandry rank sync. No sync jobs run in R0/R1.

# Integration Hub (Phase 12)

A bounded, **additive** milestone. The Integration Hub unifies how organization administrators
connect, configure, test, monitor, and manage external services. It **reuses** every existing
integration (Discord, Roblox, ER:LC/PRC, the automation event bus, the encrypted-credential system,
the audit log, entitlements) and adds only what was missing: outgoing webhook endpoints, Ordinex API
keys, and the unified Hub itself. It does **not** replace any existing system.

Route: `/app/integrations`. Legend: **IMPLEMENTED**, **PARTIAL**, **FUTURE**.

## Architecture

- **Pure helpers** `@commandry/integrations/hub` (7 unit tests): deterministic overall-health
  (`computeOverallHealth`), the SSRF guard (`isSafeWebhookUrl`), webhook signing + backoff
  (`signWebhookPayload`, `webhookBackoffMs`), and API-key generation/hashing/scopes (`generateApiKey`,
  `hashApiKey`, `API_SCOPES`).
- **Service** `@commandry/api/integrations`: `getIntegrationHub` (aggregation + deterministic health),
  Discord config/connect/test, webhook endpoint management + delivery pipeline, API-key management +
  authentication, and the unified activity feed.
- **Reused**: `IntegrationCredential` (encrypted, `encryptSecret`/`decryptSecret`), the ER:LC service
  (`getErlcIntegration`/`connectErlc`/`checkErlcHealth`), the Discord service
  (`connectDiscord`/`getDiscordClientForOrganization`), Roblox account-linking, `publishEvent` + the
  automation event bus, `recordAuditEvent`, entitlements, and permissions.

## Supported integrations (cards)

Each card shows name, status (`CONNECTED / DEGRADED / ERROR / DISCONNECTED / CONFIGURATION_REQUIRED`),
health, last success, last error, mode, and configure/test/disconnect actions. Health is deterministic
and never claims "healthy" just because credentials exist.

### Discord — **IMPLEMENTED (reused)** / live delivery **PARTIAL**

Reuses the existing bot service. The Hub exposes connect (bot token + guild), channel mapping
(announcements/shifts/applications/training/audit/notifications/cad) and role mapping (stored in the
credential metadata), and **Test Discord Integration** diagnostics. Simulation mode (`DISCORD_MODE` not
`live`) is surfaced as **DEGRADED** and clearly labelled — no live Discord call is claimed. The
automation `send_discord_message` action now executes through this service. Live delivery requires a
real bot token + `DISCORD_MODE=live` (not exercised in this environment).

### Roblox — **IMPLEMENTED (reused)** / group-rank sync **FUTURE**

Reuses the safe account-linking system (no cookies/scraping/passwords). The Hub shows linking coverage
(`linked / active members`). **Ordinex-role → Roblox-group-rank synchronization is FUTURE** — the
available Roblox APIs do not safely permit writing group ranks, so it is not claimed as implemented.

### ER:LC / PRC — **IMPLEMENTED (reused)**

Reuses the existing PRC client + service unchanged. The Hub embeds the existing connect form (connect /
test / rotate / disconnect); credentials remain encrypted in `IntegrationCredential` and are never
returned in plaintext. Status/health/last-success/last-error come from the existing service.

### Webhooks (outgoing) — **IMPLEMENTED (additive)**

New `WebhookEndpoint` + `WebhookDelivery` models. Create/name/rotate-secret/enable/disable/delete/test,
subscribe to supported events, and view delivery history (event, timestamp, HTTP status, duration,
attempts, result, error). The **signing secret is shown once** and never returned again (stored
AES-256-GCM). Deliveries are signed (`x-ordinex-signature: t=<ts>,v1=<hmac>`), **idempotent** per
`(endpoint, correlation)`, retried with exponential backoff (max 5 attempts) by the worker
`webhook.dispatch` job, and an endpoint is auto-disabled after sustained failure. Fan-out reuses the
existing event bus: `publishEvent` enqueues deliveries for subscribed endpoints — **no duplicate event
publishing**. **SSRF-guarded**: only public HTTPS destinations (private/loopback/metadata hosts blocked).

### Ordinex API Keys — **IMPLEMENTED (additive)**

New `ApiKey` model. Keys are cryptographically generated (`ordx_…`), **shown once**, stored as a
SHA-256 hash, tenant-bound, revocable, expirable, and **scoped** (`members.read`, `departments.read`,
`shifts.read`, `applications.read`, `server.read`, `cad.read`, `rms.read`, `webhooks.manage`). Creation
and revocation are audited; keys are never logged. `authenticateApiKey(rawKey, scope)` enforces
status/expiry/scope and updates last-used. A sample scope-enforced endpoint (`GET /api/v1/members`,
requires `members.read`) demonstrates the flow; the full public API surface is **FUTURE**.

## Diagnostics + health

`getIntegrationHub` returns per-integration diagnostics (connection, configuration, sync, recent
failures) and a deterministic **overall** state (`HEALTHY / DEGRADED / ACTION_REQUIRED / OUTAGE`).
Never-configured disconnected integrations do not count against health. The overall health + per-card
issues surface in a **Command Center "Integration Health" widget**, and each issue deep-links to
`/app/integrations?open=<key>`.

## Automation integration

Existing automation actions are exposed/reused, not duplicated: `webhook`/`http_request` (already
implemented), `execute_server_command` (ER:LC), and `send_discord_message` (now wired to the Discord
service). Outgoing webhooks consume the same events as automations via the shared bus.

## Events used (webhook subscriptions)

Reuses the existing `EVENT_TYPES`: `Member.Created`, `Member.Promoted`, `Shift.Started`,
`Shift.Completed`, `Application.Submitted`, `Application.Approved`, `Training.Completed`,
`Announcement.Published`, `CAD.CallCreated`, `Case.Created`, `Case.Closed`, `Evidence.Collected`, etc.

## Permissions

Added `integrations.view / manage / credentials / webhooks / logs / test` (granted to owner + admin),
alongside the existing `organization:manage_integrations`. All enforcement is server-side and
tenant-isolated.

## Entitlements

Reuses the existing feature registry: the Discord card requires `discord.integration`, webhooks require
`webhooks.basic`, and API keys require `api.public`. When a capability is not in the plan, the Hub
**removes** those controls (server-filtered), rather than showing a disabled button; the Plans page
explains the upgrade path.

## Security

Credential encryption (AES-256-GCM, reused); secrets redacted (webhook secret + API key shown once,
never after); API keys hashed (SHA-256); webhook signatures (HMAC-SHA256 with timestamp); tenant
isolation and permission enforcement (tested); SSRF protection for webhook destinations; idempotent
delivery (replay protection); audit logging of integration changes. No secrets appear in browser
payloads after initial creation (tested — plaintext is absent from list views and stored rows).

## Extension points

New providers add a card in `getIntegrationHub` + reuse the credential/health pattern; new webhook
events are any `EVENT_TYPES`; new API scopes extend `API_SCOPES`. A marketplace / generic plugin
framework is intentionally **out of scope** for this phase.

## Known limitations / follow-ups

- Live Discord delivery + a live PRC round-trip were not exercised (no real external credentials in this
  environment); both are wired and clearly report simulation vs live.
- Roblox group-rank write-sync is FUTURE (API limitation).
- The public API surface beyond the sample `/api/v1/members` endpoint is FUTURE.
- A full multi-step setup wizard is represented by the card-driven configure flow + Command Center
  deep-links; a dedicated first-run stepper is a follow-up.

# Discord Shift Announcements & Events

Uses the **shared** Ordinex Discord integration (`@commandry/integrations/discord-service`, bot
token + guild stored encrypted in `IntegrationCredential`). No separate bot, token store, OAuth
flow, or guild model.

## Configuration (`ShiftSchedulingSettings`)

Announcement channel, event location, announcement template, mention roles, `hostsMayPublish`,
`approvalBeforePublish`, `updateOnChange`, `cancelDeletesEvent`, reminder offsets,
`allowPublishWithoutHost`, start window. Role mentions require explicit configuration — no
unrestricted `@everyone`.

## Publish

`publishShift` validates the shift + host, renders the announcement via a **safe template**
(`renderAnnouncementTemplate` — only whitelisted `{{shift.*}}` variables are substituted; unknown
variables are left literally and never evaluated), posts the message, creates a Discord scheduled
event, and stores the message/channel/event IDs.

- **Idempotency / retry-safe**: each step runs only if its stored ID is absent. A retry after a
  partial failure completes the missing step without creating duplicates (integration-tested: a
  second publish keeps the same `discordEventId`).
- **Partial state**: if one operation succeeds and the other fails, `discordState = PARTIAL` and the
  action is safely retryable; `FAILED` if both fail (the shift is preserved either way).

## Scheduled event mapping

Title → event name, description + Ordinex URL → event description, scheduled start/end → event
times, configured location/server → event location. On cancel (`cancelScheduledShift`) the event is
cancelled when `cancelDeletesEvent`; on completion the event is completed/cancelled where supported.

## Reminders

`sendDueShiftReminders` (worker) sends host reminders at configured offsets, deduplicated per
`(shift, offset)` and marked via `lastRemindedOffset` — no duplicate reminders across worker runs.

## Failure handling

Discord outage preserves the shift and marks publication `PARTIAL`/`FAILED` for safe retry. The live
client maps 429 → rate-limit (with retry-after), 403 → missing permission, 404 → not found, 5xx →
outage.

## Test tier

**Mock-adapter tested** (publish success, idempotent retry, partial-failure state). The real
`createLiveDiscordClient` (REST) is implemented but **not live-verified** here (no bot/guild). Set
`DISCORD_MODE=live` + credentials for live operation.

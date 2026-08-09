# Automation Platform (Phase 7)

The event-driven backbone connecting every Ordinex subsystem. Modules publish standardized events;
automations match a trigger, evaluate conditions, and run actions through a durable queue. No module
embeds its own automation logic — everything flows through the shared bus.

## 1. Architecture

```
Module (Announcements, Shifts, Workflow, Website, …)
  → publishEvent(standardized event)            [Event Bus]
     → AutomationEventLog (immutable)            [Audit / replay]
     → match enabled automations by trigger      [Trigger Registry]
        → evaluateConditions (server-side)        [Condition Engine]
           → create AutomationRun (QUEUED)        [Idempotent per event]
              → worker processQueuedRuns          [Execution Queue]
                 → executeAction (reuse services) [Action Engine]
                    → COMPLETED / RETRYING / FAILED (backoff, dead-letter)
```

- Pure domain: `@commandry/automation` — event/trigger registry, the condition engine
  (`evaluateConditions`, AND/OR/nested/negation, operators), the action registry (with `aiReady`
  flags), retry/backoff, and built-in templates. Unit-tested; registry-based so packs plug in.
- Service: `@commandry/api/automation` — the bus (`publishEvent`), the executor (`runAutomation`),
  the queue processor (`processQueuedRuns`), CRUD, templates, and analytics.
- Worker: `automation.dispatch` job runs `processQueuedRuns` on a cadence (durable, retry-safe).

## 2. Event Bus

`publishEvent({ type, organizationId, resourceId?, actorUserId?, metadata?, correlationId? })` writes
an immutable `AutomationEventLog`, then matches + queues automations. Events carry organization,
resource, type, timestamp, actor, metadata, **correlationId**, and version. Wired producers today:
`Announcement.Published`, `Application.Approved` / `Training.Completed` / `Workflow.Completed`,
`Shift.Completed`, `Website.Published` — adding more is a one-line `publishEvent` call in a module.

## 3. Trigger Registry

`TRIGGERS` maps every event type to a category (organizations/members/departments/applications/
workflow/training/announcements/shifts/sessions/attendance/website/server/cad) and the metadata
fields available to conditions/actions.

## 4. Condition Engine

`ConditionGroup { combinator: AND|OR, negate?, conditions: (Condition | ConditionGroup)[] }` with
operators `eq/neq/gt/gte/lt/lte/contains/in/exists`, nested groups, and negation. `evaluateConditions`
runs **server-side** against the event context (fields + `metadata.*`). Empty conditions pass.

## 5. Action Engine

`ACTIONS` registry (label, category, `aiReady`, `rollbackable`). Implemented actions reuse existing
Ordinex services: `send_notification` (to actor / roles / all members via the Notification system),
`execute_server_command` (ER:LC client), `assign_department` (member system), `webhook` /
`http_request` (fetch), `delay`, `refresh_sitemap`, `create_task`. `publish_announcement`,
`start_workflow`, and the AI actions are registered and recorded (AI-ready) — future implementations
plug in without changing the engine.

## 6. Execution Queue + Failure Recovery

Runs move `QUEUED → RUNNING → COMPLETED / FAILED / RETRYING / CANCELLED`. Durability is DB-backed
(`AutomationRun`) processed by the worker. **Idempotency** is enforced by a unique
`(automationId, correlationId)` constraint — an event never runs an automation twice. Failures retry
with exponential backoff (`nextRetryDelayMs`) up to `DEFAULT_MAX_ATTEMPTS`, then dead-letter as
`FAILED` with the reason, retry count, next-retry time, related resource, and a per-action execution
log. Outages (Discord/ER:LC/webhook/DB) surface as retryable failures, not lost work.

## 7. Permissions

`automation.view/create/edit/delete/execute/pause/resume/logs/templates` — organization-aware,
server-enforced. Management is gated by the `automations.builder` entitlement; the event bus itself
is infrastructure and runs for any plan (only enabled automations execute).

## 8. Analytics

Executions, success/failure rate, average duration, top triggers, and per-automation run history —
never exposing another organization's automation data.

## 9. Command Center (aggregation foundation)

`getCommandCenter(orgId)` returns a clean read-only snapshot from every subsystem (server status,
pending applications, workflow queue, upcoming shifts, recent announcements, training completed,
website views, automation health, CAD active calls, unread notifications, and a composite community
health score) — the backend foundation for future dashboards. `GET /api/command-center`.

## 10. Marketplace + Developer SDK extension points

Everything is registry-based, so future packs register without redesign:

- **Custom triggers**: add to `EVENT_TYPES` + `TRIGGERS` and call `publishEvent`.
- **Custom actions**: add to `ACTION_TYPES` + `ACTIONS` + a branch in `executeAction`.
- **Custom conditions**: extend `OPERATORS`.
- **Automation templates / action packs / trigger packs / community templates / third-party
  integrations**: ship as `AutomationTemplateSeed[]` and register.

## 11. AI readiness

AI actions (`ai_summarize_report`, `ai_score_application`, `ai_generate_announcement`) are registered
and flagged `aiReady`. A future AI provider implements their `executeAction` branches — the trigger,
condition, queue, retry, and analytics machinery are unchanged.

## 12. How every module participates

Producers call `publishEvent` at meaningful moments; the platform consumes existing services as
actions. There is one event vocabulary, one condition engine, one action registry, one execution
queue, one idempotency guarantee, and one analytics surface — so AI, enterprise workflows, and
third-party integrations are additive, not architectural rewrites.

## Test tiers

Unit-tested (triggers, condition operators/nesting/negation, retry/backoff, templates) and
integration-tested (publish → match → condition → action → complete; idempotency; retry on failure;
tenant isolation; analytics). The visual builder is functional (create/enable/disable + trigger +
action); full branching/delays UI and AI are documented follow-ups.

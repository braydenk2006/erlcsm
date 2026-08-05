# Plans — Feature Verification Matrix

Generated from the live capability registry (`@commandry/entitlements`). Every configured capability appears exactly once. A capability is **Verified Complete** only when it has a working UI + backend + persistence + tenant isolation + permission enforcement.

## Summary

- Total capabilities: **125**
- Verified Complete: **26**
- Partially Implemented: **12**
- Coming Soon: **4**
- Missing: **83**

The public Plans page shows a capability as "included" only when Verified or Partial; everything else renders as **Coming Soon** and is never advertised as complete.

## Core Platform

| Feature                         | Capability Key              | Lowest Plan | Status                | Evidence / Notes                                                           |
| ------------------------------- | --------------------------- | ----------- | --------------------- | -------------------------------------------------------------------------- |
| Organizations                   | `core.organizations`        | Start-Up    | Verified Complete     | Org CRUD + switch (packages/api organizations/service, /api/organizations) |
| Members                         | `core.members`              | Start-Up    | Partially Implemented | Memberships + invite service (limit-enforced); no members UI               |
| Departments                     | `core.departments`          | Start-Up    | Partially Implemented | Department model; placeholder module                                       |
| Basic permissions               | `core.permissions.basic`    | Start-Up    | Verified Complete     | authorize() engine + simulator (packages/permissions)                      |
| Advanced permission templates   | `core.permissions.advanced` | Growth      | Missing               | Not implemented                                                            |
| Basic audit logs                | `core.audit.basic`          | Start-Up    | Verified Complete     | audit_events + recordAuditEvent (packages/audit)                           |
| Advanced audit logs & retention | `core.audit.advanced`       | Enterprise  | Missing               | Not implemented                                                            |
| Notifications                   | `core.notifications`        | Start-Up    | Missing               | Not implemented                                                            |
| Mobile access                   | `core.mobile`               | Start-Up    | Partially Implemented | Responsive layout                                                          |
| Installable PWA                 | `core.pwa`                  | Start-Up    | Partially Implemented | Web manifest (not offline)                                                 |

## Community Integrations

| Feature                | Capability Key             | Lowest Plan | Status                | Evidence / Notes                        |
| ---------------------- | -------------------------- | ----------- | --------------------- | --------------------------------------- |
| Discord integration    | `discord.integration`      | Start-Up    | Partially Implemented | Discord OAuth when configured; bot idle |
| Roblox account linking | `roblox.account_linking`   | Start-Up    | Missing               | Not implemented                         |
| Activity tracking      | `activity.tracking`        | Start-Up    | Missing               | Not implemented                         |
| Shift tracking         | `shifts.tracking`          | Start-Up    | Missing               | Not implemented                         |
| Session management     | `sessions.management`      | Start-Up    | Missing               | Not implemented                         |
| Announcements          | `announcements.management` | Start-Up    | Missing               | Not implemented                         |

## Server Management

| Feature                        | Capability Key                     | Lowest Plan | Status            | Evidence / Notes                                                    |
| ------------------------------ | ---------------------------------- | ----------- | ----------------- | ------------------------------------------------------------------- |
| Live server status             | `server.live_status`               | Start-Up    | Verified Complete | Live Server dashboard + /api/erlc/snapshot (simulator + PRC client) |
| Current player list            | `server.players`                   | Start-Up    | Verified Complete | Player list in Live dashboard                                       |
| Player teams                   | `server.teams`                     | Start-Up    | Verified Complete | Team breakdown                                                      |
| Player locations & map         | `server.locations`                 | Start-Up    | Verified Complete | Map tab (sim coords; PRC has none)                                  |
| Callsigns                      | `server.callsigns`                 | Start-Up    | Verified Complete | Callsign column                                                     |
| Wanted stars                   | `server.wanted_status`             | Start-Up    | Verified Complete | Wanted stars column                                                 |
| Vehicle data                   | `server.vehicles`                  | Start-Up    | Verified Complete | Vehicles panel                                                      |
| Join & leave logs              | `server.join_leave_logs`           | Start-Up    | Verified Complete | Join/Leave tab                                                      |
| Kill logs                      | `server.kill_logs`                 | Start-Up    | Verified Complete | Kill Logs tab                                                       |
| Command logs                   | `server.command_logs`              | Start-Up    | Verified Complete | Command Logs tab                                                    |
| Basic remote commands          | `server.remote_commands.basic`     | Start-Up    | Verified Complete | Remote command console + audit                                      |
| Advanced remote commands       | `server.remote_commands.advanced`  | Growth      | Missing           | Not implemented                                                     |
| Queue monitoring               | `server.queue_monitoring`          | Growth      | Missing           | Not implemented                                                     |
| Moderator-call dashboard       | `server.moderator_calls`           | Growth      | Missing           | Not implemented                                                     |
| Emergency-call automation      | `server.emergency_call_automation` | Growth      | Missing           | Not implemented                                                     |
| Live heatmaps                  | `server.live_heatmaps`             | Growth      | Missing           | Not implemented                                                     |
| ER:LC integration health       | `server.health_monitoring`         | Start-Up    | Verified Complete | Integrations health + worker                                        |
| Player-history correlation     | `server.player_history`            | Growth      | Verified Complete | CAD Personnel + correlation                                         |
| Custom in-game command builder | `server.custom_commands`           | Growth      | Missing           | Not implemented                                                     |

## CAD / MDT

| Feature                     | Capability Key             | Lowest Plan | Status                | Evidence / Notes                                 |
| --------------------------- | -------------------------- | ----------- | --------------------- | ------------------------------------------------ |
| CAD access                  | `cad.access`               | Start-Up    | Verified Complete     | CAD workspace gated by cad.access + entitlement  |
| Dispatch board              | `cad.dispatch.basic`       | Start-Up    | Verified Complete     | Dispatch board (units/calls/assign/timeline)     |
| Advanced dispatch           | `cad.dispatch.advanced`    | Growth      | Missing               | Not implemented                                  |
| MDT                         | `cad.mdt`                  | Start-Up    | Partially Implemented | Dispatch detail panel (no dedicated MDT surface) |
| Person records              | `cad.people`               | Start-Up    | Verified Complete     | Civilians RMS                                    |
| Vehicle records             | `cad.vehicles`             | Start-Up    | Verified Complete     | Vehicle records + plate lookup                   |
| Incident reports            | `cad.incident_reports`     | Start-Up    | Partially Implemented | Record type only                                 |
| Arrest reports              | `cad.arrest_reports`       | Start-Up    | Partially Implemented | Record type only                                 |
| Citations                   | `cad.citations`            | Start-Up    | Verified Complete     | Records (CITATION)                               |
| Written warnings            | `cad.warnings`             | Start-Up    | Verified Complete     | Records (WARNING)                                |
| Warrants                    | `cad.warrants`             | Start-Up    | Verified Complete     | Warrant approval lifecycle (M2)                  |
| BOLOs                       | `cad.bolos`                | Start-Up    | Verified Complete     | BOLOs                                            |
| Penal code                  | `cad.penal_code`           | Start-Up    | Verified Complete     | Tenant penal code (M2)                           |
| Basic dispatch analytics    | `cad.analytics.basic`      | Start-Up    | Partially Implemented | Command Center priority distribution only        |
| Advanced dispatch analytics | `cad.analytics.advanced`   | Growth      | Missing               | Not implemented                                  |
| Court system                | `cad.court`                | Growth      | Missing               | Not implemented                                  |
| Evidence locker             | `cad.evidence`             | Growth      | Missing               | Not implemented                                  |
| Chain of custody            | `cad.chain_of_custody`     | Growth      | Missing               | Not implemented                                  |
| Fire / EMS workflows        | `cad.fire_ems`             | Growth      | Missing               | Not implemented                                  |
| Civilian portal             | `cad.civilian_portal`      | Growth      | Missing               | Not implemented                                  |
| Character management        | `cad.characters`           | Growth      | Missing               | Not implemented                                  |
| Business registry           | `cad.business_registry`    | Growth      | Missing               | Not implemented                                  |
| Property registry           | `cad.property_registry`    | Growth      | Missing               | Not implemented                                  |
| Fleet management            | `cad.fleet`                | Growth      | Missing               | Not implemented                                  |
| Detective case management   | `cad.detective`            | Growth      | Missing               | Not implemented                                  |
| Multi-agency dispatch       | `cad.multi_agency`         | Growth      | Partially Implemented | Agencies model, single agency per call           |
| Unit recommendations        | `cad.unit_recommendations` | Growth      | Missing               | Not implemented                                  |
| Live unit tracking          | `cad.live_unit_tracking`   | Growth      | Missing               | Not implemented                                  |
| Report approval workflows   | `cad.report_approvals`     | Growth      | Verified Complete     | Record/warrant review lifecycle (M2)             |
| PDF export                  | `cad.pdf_export`           | Growth      | Missing               | Not implemented                                  |
| Digital signatures          | `cad.digital_signatures`   | Growth      | Missing               | Not implemented                                  |

## Applications

| Feature                        | Capability Key            | Lowest Plan | Status  | Evidence / Notes |
| ------------------------------ | ------------------------- | ----------- | ------- | ---------------- |
| Applications                   | `applications.basic`      | Start-Up    | Missing | Not implemented  |
| Advanced application workflows | `applications.advanced`   | Growth      | Missing | Not implemented  |
| Interview scheduling           | `applications.interviews` | Growth      | Missing | Not implemented  |

## Training

| Feature                | Capability Key            | Lowest Plan | Status  | Evidence / Notes |
| ---------------------- | ------------------------- | ----------- | ------- | ---------------- |
| Basic training         | `training.basic`          | Start-Up    | Missing | Not implemented  |
| Certification tracking | `training.certifications` | Growth      | Missing | Not implemented  |

## Forms

| Feature        | Capability Key   | Lowest Plan | Status  | Evidence / Notes |
| -------------- | ---------------- | ----------- | ------- | ---------------- |
| Basic forms    | `forms.basic`    | Start-Up    | Missing | Not implemented  |
| Advanced forms | `forms.advanced` | Growth      | Missing | Not implemented  |

## Workflows & Automation

| Feature            | Capability Key        | Lowest Plan | Status  | Evidence / Notes |
| ------------------ | --------------------- | ----------- | ------- | ---------------- |
| Workflow builder   | `workflows.builder`   | Growth      | Missing | Not implemented  |
| Automation builder | `automations.builder` | Growth      | Missing | Not implemented  |

## People Operations

| Feature             | Capability Key           | Lowest Plan | Status  | Evidence / Notes |
| ------------------- | ------------------------ | ----------- | ------- | ---------------- |
| Performance reviews | `performance.reviews`    | Growth      | Missing | Not implemented  |
| Leave requests      | `leave.management`       | Growth      | Missing | Not implemented  |
| Recognition system  | `recognition.management` | Growth      | Missing | Not implemented  |

## Documents

| Feature                     | Capability Key       | Lowest Plan | Status                | Evidence / Notes |
| --------------------------- | -------------------- | ----------- | --------------------- | ---------------- |
| Basic document storage      | `documents.basic`    | Start-Up    | Partially Implemented | Schema only      |
| Advanced document workflows | `documents.advanced` | Growth      | Missing               | Not implemented  |
| Knowledge base              | `knowledge_base`     | Growth      | Missing               | Not implemented  |

## Website

| Feature                 | Capability Key            | Lowest Plan | Status                | Evidence / Notes |
| ----------------------- | ------------------------- | ----------- | --------------------- | ---------------- |
| Website builder         | `website.builder`         | Start-Up    | Missing               | Not implemented  |
| Public staff directory  | `website.public_staff`    | Start-Up    | Partially Implemented | Scaffold surface |
| Unlimited website pages | `website.unlimited_pages` | Growth      | Missing               | Not implemented  |
| Custom domains          | `website.custom_domains`  | Enterprise  | Missing               | Not implemented  |
| White-label branding    | `website.white_label`     | Enterprise  | Missing               | Not implemented  |

## Analytics

| Feature            | Capability Key                | Lowest Plan | Status  | Evidence / Notes |
| ------------------ | ----------------------------- | ----------- | ------- | ---------------- |
| Basic analytics    | `analytics.basic`             | Growth      | Missing | Not implemented  |
| Advanced analytics | `analytics.advanced`          | Growth      | Missing | Not implemented  |
| Custom dashboards  | `analytics.custom_dashboards` | Growth      | Missing | Not implemented  |
| Scheduled reports  | `analytics.scheduled_reports` | Growth      | Missing | Not implemented  |

## AI

| Feature                      | Capability Key              | Lowest Plan | Status  | Evidence / Notes |
| ---------------------------- | --------------------------- | ----------- | ------- | ---------------- |
| AI report summaries          | `ai.report_summary`         | Start-Up    | Missing | Not implemented  |
| AI application summaries     | `ai.application_summary`    | Start-Up    | Missing | Not implemented  |
| AI report drafting           | `ai.report_writer`          | Growth      | Missing | Not implemented  |
| AI narrative generation      | `ai.narratives`             | Growth      | Missing | Not implemented  |
| Natural-language search      | `ai.search`                 | Growth      | Missing | Not implemented  |
| AI analytics summaries       | `ai.analytics`              | Growth      | Missing | Not implemented  |
| AI policy assistant          | `ai.policy_assistant`       | Growth      | Missing | Not implemented  |
| AI application assistance    | `ai.application_assistance` | Growth      | Missing | Not implemented  |
| AI workflow drafting         | `ai.workflow_assistant`     | Growth      | Missing | Not implemented  |
| AI dispatch assistant        | `ai.dispatch_assistant`     | Enterprise  | Missing | Not implemented  |
| AI case-timeline builder     | `ai.timeline_builder`       | Enterprise  | Missing | Not implemented  |
| AI trend detection           | `ai.trend_detection`        | Enterprise  | Missing | Not implemented  |
| AI knowledge-base assistance | `ai.knowledge_base`         | Enterprise  | Missing | Not implemented  |

## Integrations & Developer Platform

| Feature             | Capability Key        | Lowest Plan | Status  | Evidence / Notes |
| ------------------- | --------------------- | ----------- | ------- | ---------------- |
| Public API          | `api.public`          | Growth      | Missing | Not implemented  |
| Advanced API        | `api.advanced`        | Growth      | Missing | Not implemented  |
| Outgoing webhooks   | `webhooks.basic`      | Growth      | Missing | Not implemented  |
| Advanced webhooks   | `webhooks.advanced`   | Growth      | Missing | Not implemented  |
| Custom integrations | `integrations.custom` | Enterprise  | Missing | Not implemented  |

## Enterprise Administration

| Feature                     | Capability Key                     | Lowest Plan | Status  | Evidence / Notes |
| --------------------------- | ---------------------------------- | ----------- | ------- | ---------------- |
| Multi-community management  | `enterprise.multi_organization`    | Enterprise  | Missing | Not implemented  |
| Cross-community staff       | `enterprise.cross_community_staff` | Enterprise  | Missing | Not implemented  |
| Global permission templates | `enterprise.global_permissions`    | Enterprise  | Missing | Not implemented  |
| Global policy management    | `enterprise.global_policies`       | Enterprise  | Missing | Not implemented  |
| Centralized analytics       | `enterprise.centralized_analytics` | Enterprise  | Missing | Not implemented  |
| Bulk / advanced import      | `enterprise.bulk_import`           | Enterprise  | Missing | Not implemented  |
| Bulk / advanced export      | `enterprise.bulk_export`           | Enterprise  | Missing | Not implemented  |

## Security

| Feature                        | Capability Key               | Lowest Plan | Status  | Evidence / Notes |
| ------------------------------ | ---------------------------- | ----------- | ------- | ---------------- |
| Mandatory MFA policy           | `security.mfa_policy`        | Enterprise  | Missing | Not implemented  |
| IP restrictions                | `security.ip_restrictions`   | Enterprise  | Missing | Not implemented  |
| Custom data-retention policies | `security.custom_retention`  | Enterprise  | Missing | Not implemented  |
| Backup scheduling              | `security.backup_scheduling` | Enterprise  | Missing | Not implemented  |
| Disaster-recovery support      | `security.disaster_recovery` | Enterprise  | Missing | Not implemented  |
| Single sign-on (SSO)           | `security.sso`               | —           | Missing | Not implemented  |

## Support

| Feature                      | Capability Key               | Lowest Plan | Status      | Evidence / Notes                   |
| ---------------------------- | ---------------------------- | ----------- | ----------- | ---------------------------------- |
| Priority support             | `support.priority`           | Enterprise  | Coming Soon | Operational / onboarding, not code |
| Migration assistance         | `support.migration`          | Enterprise  | Coming Soon | Operational / onboarding, not code |
| Guided onboarding            | `support.guided_onboarding`  | Enterprise  | Coming Soon | Operational / onboarding, not code |
| Dedicated account management | `support.account_management` | Enterprise  | Coming Soon | Operational / onboarding, not code |

> This matrix is regenerated from the registry; see `packages/entitlements/src/verification.ts` for the source of truth.

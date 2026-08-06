# Plans — Feature Verification Matrix

Generated from the live capability registry (`@commandry/entitlements`).

## Summary

- Total capabilities: **125**
- Verified Complete: **37**
- Partially Implemented: **12**
- Coming Soon: **4**
- Missing: **72**

The public Plans page shows a capability as "included" only when Verified or Partial; else **Coming Soon**.

## Core Platform

| Feature                         | Capability Key              | Lowest Plan | Status                |
| ------------------------------- | --------------------------- | ----------- | --------------------- |
| Organizations                   | `core.organizations`        | Start-Up    | Verified Complete     |
| Members                         | `core.members`              | Start-Up    | Verified Complete     |
| Departments                     | `core.departments`          | Start-Up    | Verified Complete     |
| Basic permissions               | `core.permissions.basic`    | Start-Up    | Verified Complete     |
| Advanced permission templates   | `core.permissions.advanced` | Growth      | Missing               |
| Basic audit logs                | `core.audit.basic`          | Start-Up    | Verified Complete     |
| Advanced audit logs & retention | `core.audit.advanced`       | Enterprise  | Missing               |
| Notifications                   | `core.notifications`        | Start-Up    | Verified Complete     |
| Mobile access                   | `core.mobile`               | Start-Up    | Partially Implemented |
| Installable PWA                 | `core.pwa`                  | Start-Up    | Partially Implemented |

## Community Integrations

| Feature                | Capability Key             | Lowest Plan | Status                |
| ---------------------- | -------------------------- | ----------- | --------------------- |
| Discord integration    | `discord.integration`      | Start-Up    | Partially Implemented |
| Roblox account linking | `roblox.account_linking`   | Start-Up    | Verified Complete     |
| Activity tracking      | `activity.tracking`        | Start-Up    | Verified Complete     |
| Shift tracking         | `shifts.tracking`          | Start-Up    | Verified Complete     |
| Session management     | `sessions.management`      | Start-Up    | Verified Complete     |
| Announcements          | `announcements.management` | Start-Up    | Verified Complete     |

## Server Management

| Feature                        | Capability Key                     | Lowest Plan | Status                |
| ------------------------------ | ---------------------------------- | ----------- | --------------------- |
| Live server status             | `server.live_status`               | Start-Up    | Verified Complete     |
| Current player list            | `server.players`                   | Start-Up    | Verified Complete     |
| Player teams                   | `server.teams`                     | Start-Up    | Verified Complete     |
| Player locations & map         | `server.locations`                 | Start-Up    | Partially Implemented |
| Callsigns                      | `server.callsigns`                 | Start-Up    | Verified Complete     |
| Wanted stars                   | `server.wanted_status`             | Start-Up    | Partially Implemented |
| Vehicle data                   | `server.vehicles`                  | Start-Up    | Verified Complete     |
| Join & leave logs              | `server.join_leave_logs`           | Start-Up    | Verified Complete     |
| Kill logs                      | `server.kill_logs`                 | Start-Up    | Verified Complete     |
| Command logs                   | `server.command_logs`              | Start-Up    | Verified Complete     |
| Basic remote commands          | `server.remote_commands.basic`     | Start-Up    | Verified Complete     |
| Advanced remote commands       | `server.remote_commands.advanced`  | Growth      | Missing               |
| Queue monitoring               | `server.queue_monitoring`          | Growth      | Missing               |
| Moderator-call dashboard       | `server.moderator_calls`           | Growth      | Missing               |
| Emergency-call automation      | `server.emergency_call_automation` | Growth      | Missing               |
| Live heatmaps                  | `server.live_heatmaps`             | Growth      | Missing               |
| ER:LC integration health       | `server.health_monitoring`         | Start-Up    | Verified Complete     |
| Player-history correlation     | `server.player_history`            | Growth      | Verified Complete     |
| Custom in-game command builder | `server.custom_commands`           | Growth      | Missing               |

## CAD / MDT

| Feature                     | Capability Key             | Lowest Plan | Status                |
| --------------------------- | -------------------------- | ----------- | --------------------- |
| CAD access                  | `cad.access`               | Start-Up    | Verified Complete     |
| Dispatch board              | `cad.dispatch.basic`       | Start-Up    | Verified Complete     |
| Advanced dispatch           | `cad.dispatch.advanced`    | Growth      | Missing               |
| MDT                         | `cad.mdt`                  | Start-Up    | Partially Implemented |
| Person records              | `cad.people`               | Start-Up    | Verified Complete     |
| Vehicle records             | `cad.vehicles`             | Start-Up    | Verified Complete     |
| Incident reports            | `cad.incident_reports`     | Start-Up    | Partially Implemented |
| Arrest reports              | `cad.arrest_reports`       | Start-Up    | Partially Implemented |
| Citations                   | `cad.citations`            | Start-Up    | Verified Complete     |
| Written warnings            | `cad.warnings`             | Start-Up    | Verified Complete     |
| Warrants                    | `cad.warrants`             | Start-Up    | Verified Complete     |
| BOLOs                       | `cad.bolos`                | Start-Up    | Verified Complete     |
| Penal code                  | `cad.penal_code`           | Start-Up    | Verified Complete     |
| Basic dispatch analytics    | `cad.analytics.basic`      | Start-Up    | Partially Implemented |
| Advanced dispatch analytics | `cad.analytics.advanced`   | Growth      | Missing               |
| Court system                | `cad.court`                | Growth      | Missing               |
| Evidence locker             | `cad.evidence`             | Growth      | Missing               |
| Chain of custody            | `cad.chain_of_custody`     | Growth      | Missing               |
| Fire / EMS workflows        | `cad.fire_ems`             | Growth      | Missing               |
| Civilian portal             | `cad.civilian_portal`      | Growth      | Missing               |
| Character management        | `cad.characters`           | Growth      | Missing               |
| Business registry           | `cad.business_registry`    | Growth      | Missing               |
| Property registry           | `cad.property_registry`    | Growth      | Missing               |
| Fleet management            | `cad.fleet`                | Growth      | Missing               |
| Detective case management   | `cad.detective`            | Growth      | Missing               |
| Multi-agency dispatch       | `cad.multi_agency`         | Growth      | Partially Implemented |
| Unit recommendations        | `cad.unit_recommendations` | Growth      | Missing               |
| Live unit tracking          | `cad.live_unit_tracking`   | Growth      | Missing               |
| Report approval workflows   | `cad.report_approvals`     | Growth      | Verified Complete     |
| PDF export                  | `cad.pdf_export`           | Growth      | Missing               |
| Digital signatures          | `cad.digital_signatures`   | Growth      | Missing               |

## Applications

| Feature                        | Capability Key            | Lowest Plan | Status            |
| ------------------------------ | ------------------------- | ----------- | ----------------- |
| Applications                   | `applications.basic`      | Start-Up    | Verified Complete |
| Advanced application workflows | `applications.advanced`   | Growth      | Missing           |
| Interview scheduling           | `applications.interviews` | Growth      | Missing           |

## Training

| Feature                | Capability Key            | Lowest Plan | Status            |
| ---------------------- | ------------------------- | ----------- | ----------------- |
| Basic training         | `training.basic`          | Start-Up    | Verified Complete |
| Certification tracking | `training.certifications` | Growth      | Missing           |

## Forms

| Feature        | Capability Key   | Lowest Plan | Status            |
| -------------- | ---------------- | ----------- | ----------------- |
| Basic forms    | `forms.basic`    | Start-Up    | Verified Complete |
| Advanced forms | `forms.advanced` | Growth      | Missing           |

## Workflows & Automation

| Feature            | Capability Key        | Lowest Plan | Status                |
| ------------------ | --------------------- | ----------- | --------------------- |
| Workflow builder   | `workflows.builder`   | Growth      | Partially Implemented |
| Automation builder | `automations.builder` | Growth      | Missing               |

## People Operations

| Feature             | Capability Key           | Lowest Plan | Status  |
| ------------------- | ------------------------ | ----------- | ------- |
| Performance reviews | `performance.reviews`    | Growth      | Missing |
| Leave requests      | `leave.management`       | Growth      | Missing |
| Recognition system  | `recognition.management` | Growth      | Missing |

## Documents

| Feature                     | Capability Key       | Lowest Plan | Status                |
| --------------------------- | -------------------- | ----------- | --------------------- |
| Basic document storage      | `documents.basic`    | Start-Up    | Partially Implemented |
| Advanced document workflows | `documents.advanced` | Growth      | Missing               |
| Knowledge base              | `knowledge_base`     | Growth      | Missing               |

## Website

| Feature                 | Capability Key            | Lowest Plan | Status            |
| ----------------------- | ------------------------- | ----------- | ----------------- |
| Website builder         | `website.builder`         | Start-Up    | Verified Complete |
| Public staff directory  | `website.public_staff`    | Start-Up    | Verified Complete |
| Unlimited website pages | `website.unlimited_pages` | Growth      | Missing           |
| Custom domains          | `website.custom_domains`  | Enterprise  | Missing           |
| White-label branding    | `website.white_label`     | Enterprise  | Missing           |

## Analytics

| Feature            | Capability Key                | Lowest Plan | Status  |
| ------------------ | ----------------------------- | ----------- | ------- |
| Basic analytics    | `analytics.basic`             | Growth      | Missing |
| Advanced analytics | `analytics.advanced`          | Growth      | Missing |
| Custom dashboards  | `analytics.custom_dashboards` | Growth      | Missing |
| Scheduled reports  | `analytics.scheduled_reports` | Growth      | Missing |

## AI

| Feature                      | Capability Key              | Lowest Plan | Status  |
| ---------------------------- | --------------------------- | ----------- | ------- |
| AI report summaries          | `ai.report_summary`         | Start-Up    | Missing |
| AI application summaries     | `ai.application_summary`    | Start-Up    | Missing |
| AI report drafting           | `ai.report_writer`          | Growth      | Missing |
| AI narrative generation      | `ai.narratives`             | Growth      | Missing |
| Natural-language search      | `ai.search`                 | Growth      | Missing |
| AI analytics summaries       | `ai.analytics`              | Growth      | Missing |
| AI policy assistant          | `ai.policy_assistant`       | Growth      | Missing |
| AI application assistance    | `ai.application_assistance` | Growth      | Missing |
| AI workflow drafting         | `ai.workflow_assistant`     | Growth      | Missing |
| AI dispatch assistant        | `ai.dispatch_assistant`     | Enterprise  | Missing |
| AI case-timeline builder     | `ai.timeline_builder`       | Enterprise  | Missing |
| AI trend detection           | `ai.trend_detection`        | Enterprise  | Missing |
| AI knowledge-base assistance | `ai.knowledge_base`         | Enterprise  | Missing |

## Integrations & Developer Platform

| Feature             | Capability Key        | Lowest Plan | Status  |
| ------------------- | --------------------- | ----------- | ------- |
| Public API          | `api.public`          | Growth      | Missing |
| Advanced API        | `api.advanced`        | Growth      | Missing |
| Outgoing webhooks   | `webhooks.basic`      | Growth      | Missing |
| Advanced webhooks   | `webhooks.advanced`   | Growth      | Missing |
| Custom integrations | `integrations.custom` | Enterprise  | Missing |

## Enterprise Administration

| Feature                     | Capability Key                     | Lowest Plan | Status  |
| --------------------------- | ---------------------------------- | ----------- | ------- |
| Multi-community management  | `enterprise.multi_organization`    | Enterprise  | Missing |
| Cross-community staff       | `enterprise.cross_community_staff` | Enterprise  | Missing |
| Global permission templates | `enterprise.global_permissions`    | Enterprise  | Missing |
| Global policy management    | `enterprise.global_policies`       | Enterprise  | Missing |
| Centralized analytics       | `enterprise.centralized_analytics` | Enterprise  | Missing |
| Bulk / advanced import      | `enterprise.bulk_import`           | Enterprise  | Missing |
| Bulk / advanced export      | `enterprise.bulk_export`           | Enterprise  | Missing |

## Security

| Feature                        | Capability Key               | Lowest Plan | Status  |
| ------------------------------ | ---------------------------- | ----------- | ------- |
| Mandatory MFA policy           | `security.mfa_policy`        | Enterprise  | Missing |
| IP restrictions                | `security.ip_restrictions`   | Enterprise  | Missing |
| Custom data-retention policies | `security.custom_retention`  | Enterprise  | Missing |
| Backup scheduling              | `security.backup_scheduling` | Enterprise  | Missing |
| Disaster-recovery support      | `security.disaster_recovery` | Enterprise  | Missing |
| Single sign-on (SSO)           | `security.sso`               | —           | Missing |

## Support

| Feature                      | Capability Key               | Lowest Plan | Status      |
| ---------------------------- | ---------------------------- | ----------- | ----------- |
| Priority support             | `support.priority`           | Enterprise  | Coming Soon |
| Migration assistance         | `support.migration`          | Enterprise  | Coming Soon |
| Guided onboarding            | `support.guided_onboarding`  | Enterprise  | Coming Soon |
| Dedicated account management | `support.account_management` | Enterprise  | Coming Soon |

> Regenerated from the registry; source of truth is `packages/entitlements/src/verification.ts`.

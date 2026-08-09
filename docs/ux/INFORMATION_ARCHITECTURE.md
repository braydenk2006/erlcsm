# Ordinex Information Architecture & Navigation Consolidation

Ordinex accumulated ~23 primary sidebar destinations across development milestones, which made it
read like twenty separate tools. This document audits every authenticated route and defines the
consolidation into **seven coherent workspaces**. No route is removed; nothing is migrated — this is a
pure navigation grouping (`apps/web/src/lib/nav-registry.ts` `WORKSPACES` / `WORKSPACE_OF` /
`buildWorkspaceNav`, rendered by `AppShell`).

## Primary workspaces (7)

`Command Center · Community · Operations · Public Safety · Workflows · Content · Administration`

Ask Ordinex is a **global launcher** (header button + Ctrl/⌘+K palette), not a workspace. The
Integration Hub lives under Administration and is treated as a completed subsystem.

## Route audit

| Route                | Class             | Old sidebar   | Workspace         | Secondary nav | Preserved | Entitlement                | Permission               |
| -------------------- | ----------------- | ------------- | ----------------- | ------------- | --------- | -------------------------- | ------------------------ |
| `/app`               | Primary Workspace | Home          | Command Center    | (landing)     | ✅        | —                          | —                        |
| `/app/insights`      | Secondary         | Insights      | Command Center    | Insights      | ✅        | —                          | `insights.view`          |
| `/app/analytics`     | Secondary         | Analytics     | Command Center    | Analytics     | ✅        | `analytics.advanced`       | —                        |
| `/app/people`        | Secondary         | People        | Community         | Members       | ✅        | `core.members`             | `member:read`            |
| `/app/staff`         | Secondary         | Staff         | Community         | Staff         | ✅        | `core.members`             | `staff:read`             |
| `/app/departments`   | Secondary         | Departments   | Community         | Departments   | ✅        | `core.departments`         | `department:read`        |
| `/app/moderation`    | Secondary         | Moderation    | Community         | Moderation    | ✅        | `server.moderator_calls`   | `moderation:read`        |
| `/app/announcements` | Secondary         | Announcements | Community         | Announcements | ✅        | `announcements.management` | `announcement:read`      |
| `/app/live`          | Secondary         | Live Server   | Operations        | Live Server   | ✅        | `server.live_status`       | `erlc:view`              |
| `/app/schedule`      | Secondary         | Schedule      | Operations        | Schedule      | ✅        | `shifts.tracking`          | `shifts.attendance.view` |
| `/app/sessions`      | Secondary         | Sessions      | Operations        | Sessions      | ✅        | `sessions.management`      | `session:read`           |
| `/app/activity`      | Secondary         | Activity      | Operations        | Activity      | ✅        | `activity.tracking`        | `activity:read`          |
| `/app/training`      | Secondary         | Training      | Operations        | Training      | ✅        | `training.basic`           | `training:read`          |
| `/app/cad`           | Secondary         | CAD           | Public Safety     | Dispatch/CAD  | ✅        | `cad.access`               | `cad.access`             |
| `/app/rms`           | Secondary         | RMS           | Public Safety     | Records (RMS) | ✅        | —                          | `rms.view`               |
| `/app/applications`  | Secondary         | Applications  | Workflows         | Applications  | ✅        | `applications.basic`       | `application:read`       |
| `/app/forms`         | Secondary         | Forms         | Workflows         | Forms         | ✅        | `forms.basic`              | —                        |
| `/app/automations`   | Secondary         | Automations   | Workflows         | Automations   | ✅        | `automations.builder`      | —                        |
| `/app/website`       | Secondary         | Website       | Content           | Website       | ✅        | `website.builder`          | —                        |
| `/app/knowledge`     | Secondary         | Knowledge     | Content           | Knowledge     | ✅        | —                          | `knowledge.view`         |
| `/app/documents`     | Secondary         | Documents     | Content           | Documents     | ✅        | `documents.basic`          | `document:read`          |
| `/app/settings`      | Settings          | Settings      | Administration    | General       | ✅        | —                          | —                        |
| `/app/integrations`  | Secondary         | Integrations  | Administration    | Integrations  | ✅        | —                          | `integrations.view`      |
| `/app/assistant`     | Global Tool       | Ask Ordinex   | (global launcher) | —             | ✅        | —                          | `ai.use`                 |
| `/app/onboarding`    | Detail            | Quick create  | (Quick Create)    | —             | ✅        | —                          | —                        |

Detail routes (`/app/[module]/…`, e.g. a case, department, article) remain reachable via drill-downs
and the Command Palette; they inherit the workspace of their parent for breadcrumbs.

Public routes (`/`, `/plans`, `/sign-in`, `/c/[org]/…`) and system routes (`/api/**`) are unchanged.

## Behavior

- The sidebar shows the seven workspaces; the **active** workspace expands to reveal its secondary
  navigation (single-column accordion). A workspace only appears when the user has ≥1 visible child
  (entitlement + permission filtered — unchanged filtering logic).
- **Breadcrumbs** (`Workspace / Page`) render above content, derived from the active workspace + child.
- **Mobile**: bottom bar = first four workspaces + **More** (opens the full workspace drawer), matching
  the intended `Home · Operations · Public Safety · Community · More` shape.
- **Ask Ordinex**: header launcher (when `ai.use`) + the existing ⌘K palette; the AI backend/routes are
  untouched.

## Result

Old primary sidebar entries: **~23** → New primary destinations: **7 workspaces** (+ global Ask
Ordinex launcher + Quick Create). Every route is preserved; nothing was removed or migrated.

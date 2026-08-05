# CAD/MDT — Integration Map

How the CAD consumes shared Ordinex services instead of duplicating them. The CAD
owns CAD records and workflows; Ordinex owns shared organizational data.

## Shared services the CAD reuses

| Shared system            | Package                                           | CAD usage                                                                                                                      |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Users / auth / session   | `@commandry/auth`, `apps/web/src/lib/session`     | Identity for every CAD request; no separate CAD auth                                                                           |
| Organizations / tenancy  | `@commandry/database`, `@/lib/organization`       | All CAD data is org-scoped via `requireActiveOrganization()`                                                                   |
| Memberships / staff      | `Membership`, `Department`, `Rank` (prisma)       | CAD units reference an Ordinex member; CAD agencies reference a Department                                                     |
| Permission engine        | `@commandry/permissions` (`authorize`, `ACTIONS`) | Granular `cad.*` actions evaluated server-side                                                                                 |
| Audit                    | `@commandry/audit` (`recordAuditEvent`)           | Consequential CAD actions (call create/close, unit off-duty, warrant issue) write audit events with `source: ERLC`/org context |
| ER:LC integration        | `@commandry/integrations` + `@commandry/erlc`     | The **only** ER:LC client; live status/players/calls, on-demand call sync, player-history correlation                          |
| Roblox identity          | `RobloxIdentity` (prisma)                         | Player-history correlation links ER:LC players to Roblox identities                                                            |
| Design system / theme    | `@commandry/ui`, `--cmd-*` tokens                 | CAD UI reuses tokens, components, and the app shell                                                                            |
| Notifications            | (framework, later milestone)                      | CAD alerts (BOLO match, warrant approved) route through the shared notification service — not a CAD-specific one               |
| AI provider              | `@commandry/ai` (later milestone)                 | CAD AI tools call the shared provider; never a second client                                                                   |
| File storage / analytics | shared (later milestones)                         | Evidence/report attachments and CAD analytics use shared infra                                                                 |

## Required shared-system changes (minimal, backward compatible)

1. **`@commandry/permissions` — additive `cad.*` actions.** New granular actions
   (`cad.access`, `cad.dispatch.*`, `cad.calls.*`, `cad.units.manage`,
   `cad.mdt.access`, `cad.people.*`, `cad.vehicles.*`, `cad.records.*`,
   `cad.warrants.*`, `cad.bolos.manage`, `cad.evidence.manage`, `cad.court.access`,
   `cad.fireems.access`, `cad.civilian.access`, `cad.analytics.view`,
   `cad.configuration.manage`) are **appended**; the legacy `cad:*` actions are
   retained. System roles (owner/admin) gain the new actions. No existing action
   is removed. Covered by regression tests in `@commandry/permissions`.

This is the only shared change in M1. No CAD-specific logic is placed into shared
packages — the actions are just identifiers; evaluation logic stays in the shared
engine, and CAD-specific mapping stays in the CAD module.

## Boundaries (do not cross)

- No non-CAD module imports `@commandry/cad` or queries `cad_*` tables.
- CAD does not modify auth, onboarding, the org dashboard, staff/apps/training/
  documents/billing/website modules, global navigation, the design system, tenant
  architecture, or the shared ER:LC/Discord/notification/AI frameworks beyond the
  additive permission change above.

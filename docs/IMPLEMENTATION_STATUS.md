# Implementation status

Honest matrix for **Release 0 / early Release 1**. Status values:

| Status | Meaning |
| --- | --- |
| **Done** | Implemented and wired for local/CI use |
| **Partial** | Scaffold, schema, or constants exist; not a complete product workflow |
| **Planned** | Intended in a later release; do not document as shipped |

## Platform foundations

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo (pnpm + Turborepo) | Done | Apps + packages |
| Next.js web shell | Done | Landing, auth pages, app layout, module placeholders |
| Design tokens / UI kit | Done | Core primitives; not a full component library |
| Prisma schema + client | Done | Migrations via package scripts |
| Better Auth magic link | Done | Dev console / log delivery |
| Discord OAuth | Partial | Enabled only when credentials configured |
| Session helpers | Done | `getSession` / `requireSession` |
| Health / ready probes | Done | `/api/health`, `/api/ready` |
| Structured logging | Done | JSON + redaction |
| CI quality gate | Done | GitHub Actions |
| Documentation | Done | This docs set |

## Tenant & identity (R1)

| Area | Status | Notes |
| --- | --- | --- |
| Create organization | Done | API + form |
| List / switch org | Done | API + switcher |
| System roles on create | Done | owner/admin/moderator/staff/member |
| Invitations service | Partial | Service + audit; HTTP/UI acceptance flow incomplete |
| Permission engine | Done | Unit tested |
| Permission simulator UI | Done | Sample actions for active actor |
| Roblox linking | Partial | Schema + ID assertion only |
| Discord identity linking | Partial | Schema only beyond OAuth login |
| MFA | Partial | `mfaEnabled` field; no enforcement UI |
| Support impersonation | Partial | Schema only |

## Domain modules

| Module | Status | Notes |
| --- | --- | --- |
| Home | Partial | App home exists; not a full ops dashboard |
| People | Partial | Nav + foundation empty state |
| Staff | Partial | Scaffold |
| Departments | Partial | Schema + scaffold |
| Sessions | Partial | Scaffold |
| Activity | Partial | Scaffold |
| Moderation | Partial | Actions reserved; no workflow |
| Applications | Partial | Scaffold |
| Training | Partial | Scaffold |
| Documents | Partial | Scaffold |
| Forms | Partial | Scaffold |
| Automations | Partial | Scaffold |
| Analytics | Partial | Safe-property helper only |
| Website | Partial | Scaffold |
| Integrations | Partial | Credential schema + stubs |
| Settings / permissions | Partial | Simulator done; broader settings TBD |
| Live Server | Partial | ER:LC simulator only |
| CAD | Partial | Permissions reserved; no CAD runtime |

## Integrations & jobs

| Area | Status | Notes |
| --- | --- | --- |
| ER:LC simulator | Done | Explicitly disconnected |
| ER:LC live client | Planned | R5 |
| Discord bot gateway / slash commands | Planned | R5; idle scaffold now |
| Interaction signature verify | Planned | R5 |
| BullMQ worker | Partial | System queue only |
| Notifications delivery | Partial | Types + preference schema |
| Stripe / billing enforcement | Partial | `PLAN_LIMITS` constants; no checkout |
| S3 uploads | Planned | Env reserved |
| AI features | Planned | Safety policy constants only (R8) |

## Release tracker

| Release | Status |
| --- | --- |
| R0 Repository & architecture | In progress |
| R1 Tenant & identity foundation | In progress |
| R2–R8 | Planned |

Authoritative product checklist for unfinished work: prefer this file over marketing copy. The in-app `/docs/status` page mirrors the release list at a high level.

# Product requirements

## Vision

Commandry is the operating system for ER:LC communities: one place to connect Discord, Roblox identity, and the live ER:LC server, then run staff, sessions, moderation, CAD, training, documents, and automations under clear tenant boundaries.

Communities should connect once and operate everything from a fast, secure, intelligent workspace — without stitching together spreadsheets, Discord bots, and ad-hoc scripts.

## Product principles

1. **Tenant isolation first** — Every operational read/write is scoped to an organization. Cross-tenant access is a hard deny.
2. **Honest capability surfacing** — Unfinished modules show as scaffolded / foundation-only. Never fake live server state, mock production orgs, or invent ER:LC endpoints.
3. **Permissions explain themselves** — Authorization is centralized (`authorize()`), roles are auditable, and a simulator shows why access was granted or denied.
4. **Auditability by default** — Sensitive mutations emit append-oriented audit events with secrets redacted.
5. **AI assists; humans decide** — AI may draft and retrieve under permission; it must not autonomously discipline, ban, or mutate without confirmation.
6. **Integrations are credentials-gated** — Discord bot, ER:LC live mode, email, Stripe, and storage stay idle or simulator-backed until real credentials are configured.
7. **Operational calm** — Prefer clear workflows and durable jobs over noisy dashboards and brittle automations.

## Target users

| Persona             | Needs                                                        |
| ------------------- | ------------------------------------------------------------ |
| Community owners    | Org setup, billing (later), integrations, ownership controls |
| Admins / leadership | Roles, departments, staff lifecycle, audit visibility        |
| Moderators          | Moderation queues, live visibility, sessions                 |
| Staff               | Shifts, activity, training, documents                        |
| Members             | Applications, documents, limited self-service                |
| Platform support    | Time-boxed, audited impersonation (planned)                  |

## Release plan summary

| Release | Theme                        | Intent                                                            |
| ------- | ---------------------------- | ----------------------------------------------------------------- |
| **R0**  | Repository & architecture    | Monorepo, schema, auth shell, packages, CI, docs                  |
| **R1**  | Tenant & identity foundation | Orgs, memberships, invitations, permissions, active org switching |
| **R2**  | Operations core              | People, staff, departments, sessions, activity                    |
| **R3**  | Recruitment & development    | Applications, training, documents                                 |
| **R4**  | Governance                   | Moderation depth, break-glass ops, exports, compliance UX         |
| **R5**  | Live ER:LC & Discord         | Encrypted credentials, live client, bot slash commands            |
| **R6**  | CAD                          | Dispatch, units, records                                          |
| **R7**  | Growth platform              | Website, forms, automations, analytics, billing enforcement       |
| **R8**  | AI                           | Assisted drafting/retrieval under safety policy                   |

R0 and early R1 are **in progress**. Later releases are planned; packages and nav placeholders exist so the architecture can grow without rewrites.

## Acceptance definition (R0 / early R1)

A foundation milestone is accepted when:

1. A developer can install, migrate, and run `pnpm dev` against Postgres + Redis.
2. A user can sign in (magic link in development; Discord OAuth when configured).
3. A user can create an organization, receive system roles, and switch active organization.
4. Organization mutations go through `@commandry/api` with Zod validation and audit events.
5. `authorize()` denies cross-tenant resource access in unit tests.
6. `/api/health` and `/api/ready` report database availability.
7. CI runs format, lint, typecheck, migrate, test, build, and a forbidden-placeholder scan.
8. Module routes render foundation-only empty states — not fake operational data.
9. Documentation matches implemented behavior (this set).

Out of scope for acceptance: live ER:LC commands, Discord runtime, CAD, Stripe checkout, production email delivery, MFA, and Playwright e2e (strategy documented; suite not yet required).

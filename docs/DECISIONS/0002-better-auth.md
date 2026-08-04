# 0002. Better Auth

Date: 2026-08-02  
Status: Accepted

## Context

Commandry needs session-based web authentication, magic-link onboarding for communities, and optional Discord OAuth — without maintaining a bespoke auth stack. Password auth is undesirable for the initial security posture.

## Decision

Use **Better Auth** with:

- Prisma adapter against the shared PostgreSQL schema
- Magic-link plugin (development console / future Resend)
- Conditional Discord social provider when client credentials exist
- Email/password **disabled**
- Next.js handler mount at `/api/auth/[...all]`
- Additional user fields: `publicId`, `platformRole`, `activeOrganizationId`, `mfaEnabled`

## Consequences

**Positive**

- Standard session cookies and OAuth flows
- Less custom crypto for tokens/sessions
- Aligns identity tables with an actively maintained library

**Trade-offs**

- Schema must stay Better Auth compatible for core user/session/account/verification tables
- Magic-link delivery quality depends on a later notifications/email milestone
- Discord community identity linking remains a separate product concern beyond OAuth login

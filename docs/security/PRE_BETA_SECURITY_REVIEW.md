# Ordinex — Pre-Beta Security Review

This is a living security review. It records the checks that are **automated and passing** versus
those still **outstanding**. It is honest: an item is only "Resolved" when a test or explicit code path
enforces it.

## Method

Isolation and authorization are enforced server-side in the service layer (`packages/api`), verified by
real-database integration tests (`vitest.integration.config.ts`). This review consolidates those tests
and adds the platform-staff + support checks required for beta.

## Findings & checks

| #   | Check                                                                             | Severity | Status            | Evidence                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------- | -------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Customer / org-owner / enterprise-owner cannot access `/staff`**                | Critical | **Resolved**      | `requirePlatformStaff` reads `user.platformRole` from the DB (authoritative, never client input); `/staff` layout + all `/api/staff/*` routes gate on it. Test: `staff-support.integration.test.ts` — an org owner (role `NONE`) is denied `getStaffOverview`/`staffListTickets`; the page layout `redirect("/app")`. |
| 2   | **Client-side role tampering does nothing**                                       | Critical | **Resolved**      | The gate ignores any client-supplied role and re-reads `platformRole` from the DB each request; the min-tier is enforced server-side (a `SUPPORT` agent is denied an `ADMIN`-min action).                                                                                                                             |
| 3   | **Support-session scope escalation / write without elevation**                    | High     | **Resolved**      | Sessions default to `read_only`; `elevated` mode requires `ADMIN`+ tier and a reason; a `SUPPORT` agent is rejected. Test asserts the escalation throws.                                                                                                                                                              |
| 4   | **Support sessions expire, are revocable, audited, tenant-scoped**                | High     | **Resolved**      | `SupportAccessSession.endsAt` bounds the window; `getActiveSupportSession` excludes expired/revoked; `revokeSupportSession` works; every start/revoke writes an audit event with `source = PLATFORM_SUPPORT`; a session is bound to one `organizationId` (no cross-tenant traversal).                                 |
| 5   | **Internal support notes never visible to customers**                             | High     | **Resolved**      | The customer read path (`getTicket`) filters `internal = true`; only `staffGetTicket` returns internal notes. Test asserts the customer view excludes the internal note and the staff view includes it.                                                                                                               |
| 6   | **Cross-tenant IDOR/BOLA (tickets)**                                              | Critical | **Resolved**      | `getTicket` scopes by `organizationId` **and** `requesterUserId`; a different org's actor cannot read the ticket (not-found). Test covers it.                                                                                                                                                                         |
| 7   | **Cross-tenant IDOR/BOLA (RMS, Knowledge, Integrations, Insights, Automation)**   | Critical | **Resolved**      | Prior-phase integration tests: RMS (`rms.integration.test.ts`), Knowledge/AI (`knowledge-ai.integration.test.ts`), Integration Hub (`integration-hub.integration.test.ts`), Insights, Automation — each asserts tenant isolation.                                                                                     |
| 8   | **AI permission bypass / restricted retrieval (Knowledge + RMS)**                 | High     | **Resolved**      | The AI retrieval pipeline is permission-scoped at each step; it only surfaces knowledge/records the requesting user may access, and cites — never fabricates. Tests: knowledge gap + tenant isolation; RMS records permission-scoped.                                                                                 |
| 9   | **API key: hashing, scope, expiry, revocation, guessing**                         | High     | **Resolved**      | Keys are SHA-256 hashed at rest, shown once, scope + tenant enforced, revocable/expirable; `authenticateApiKey` rejects wrong scope / revoked / bad key. Test in `integration-hub.integration.test.ts`.                                                                                                               |
| 10  | **Webhook SSRF + signing + secret redaction + replay/idempotency**                | High     | **Resolved**      | Public-HTTPS-only SSRF guard (private/loopback/metadata blocked); HMAC-signed; secret shown once and absent from views/rows; deliveries idempotent per `(endpoint, correlation)`. Test covers SSRF reject + secret redaction + idempotency.                                                                           |
| 11  | **Secret exposure (password hashes, OAuth/session/API secrets, encryption keys)** | Critical | **Resolved**      | Support profiles select only safe fields; credentials are AES-256-GCM encrypted; secrets never returned after creation; logger/audit redact secret-like keys.                                                                                                                                                         |
| 12  | **Audit coverage for staff/support actions**                                      | Medium   | **Resolved**      | Session start/revoke and ticket reply/note/assign/status write `PLATFORM_SUPPORT` audit events.                                                                                                                                                                                                                       |
| 13  | **CSRF / XSS / stored XSS / SQL injection / mass assignment (automated pass)**    | High     | **Outstanding**   | Next.js + Prisma provide baseline protections (parameterized queries, React escaping, same-site auth cookies), and all mutating routes validate input with Zod; a dedicated automated attack suite is not yet written.                                                                                                |
| 14  | **Billing webhook replay**                                                        | High     | **N/A (blocked)** | Billing is not yet implemented; the check applies once the provider webhook exists.                                                                                                                                                                                                                                   |
| 15  | **Rate-limit bypass / duplicate queue execution / race conditions**               | Medium   | **Partial**       | Automation + webhook deliveries are idempotent by unique constraints; a formal rate-limit and race-condition sweep is outstanding.                                                                                                                                                                                    |

## Critical & High summary

- **Critical resolved**: staff isolation, client role tampering, cross-tenant ticket IDOR, secret
  exposure, cross-tenant retrieval (RMS/Knowledge/Integrations).
- **High resolved**: support-session escalation/expiry/audit, internal-note isolation, AI retrieval
  isolation, API-key security, webhook SSRF/signing/replay.
- **High outstanding**: an automated CSRF/XSS/SQLi/mass-assignment suite; a rate-limit/race sweep.
- **Blocked**: billing webhook replay (until billing exists).

No unresolved **Critical** findings in the shipped surface. The outstanding High items (automated
web-attack suite, rate-limit sweep) and the billing-dependent checks must be completed before beta
readiness can be fully declared.

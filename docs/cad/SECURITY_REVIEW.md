# CAD/MDT — Security Review

Threat-model review with probe evidence. Severity: 🔴 high · 🟠 medium · 🟡 low · ✅ ok.

## Probe results (production runtime)

| Test                                                | Result                                     |
| --------------------------------------------------- | ------------------------------------------ |
| Unauthenticated CAD access (`GET /api/cad/summary`) | ✅ `401`                                   |
| Missing-permission access (granular `cad.*`)        | ✅ `403` (enforced via `authorize`)        |
| Cross-tenant read (Org B reads Org A call by id)    | ✅ `404` — org-scoped                      |
| Cross-tenant write (Org B closes Org A call)        | ✅ no effect (Org A call stayed `PENDING`) |

## Findings

### 🔴 Unauthorized ER:LC remote commands

`apps/web/src/app/api/erlc/command/route.ts` gates on `requireActiveOrganization()` only — it
does **not** enforce `erlc:command`. Any authenticated org member can dispatch remote server
commands. **Fix:** authorize `erlc:command` (or `cad.dispatch.manage`) server-side. (ER:LC
module; minimal, backward-compatible change — scheduled in the roadmap M1/M2.)

### 🟠 Baseline `member` role grants CAD read

`SYSTEM_ROLE_PERMISSIONS.member` includes `CAD_V2_READONLY` (`cad.people.view`,
`cad.vehicles.view`, …). A plain community member can read CAD person/vehicle records. For LE
communities that is likely over-broad. **Fix:** move CAD read behind an explicit
`cad.access` grant/role rather than baseline membership; keep civilian portal access separate.

### 🟠 Cross-tenant / not-found mutations return `200` no-op

CAD mutation services use org-scoped `updateMany`/`deleteMany`/`resolveX`, so a write to a
resource in another tenant (or a nonexistent id) silently succeeds with no effect and returns
`200` (e.g. `{ ok: true, call: null }`). No data is leaked or changed, but the status code is
misleading and complicates client handling. **Fix:** verify ownership and return `404` on
mutations.

### 🟠 ER:LC webhook replay

`verifyErlcWebhook` checks an HMAC but there is no timestamp/nonce/idempotency window, so a
captured valid webhook can be replayed. **Fix:** require a signed timestamp + reject stale/seen
signatures; dedup by event id.

### 🟡 Audit coverage gaps

Consequential actions (unit status/assignment, panic, person/vehicle updates, BOLOs, config
changes, ER:LC imports, remote commands) are not audited — reduces forensic traceability.

### 🟡 Stored content / XSS

Narratives/notes are length-validated (Zod) and rendered as text in React (auto-escaped). Low
risk today, but PDF export (future) must sanitize. No file uploads exist yet, so file-name /
file-type-spoofing vectors are N/A until evidence/attachments land.

### 🟡 Concurrency races

No optimistic locking: concurrent dispatchers editing the same call, or double warrant
clears, are last-write-wins. Unit assignment is idempotent (upsert), but a unit can be
assigned to multiple active calls.

## Not applicable yet (feature absent)

- Rank / record-type / authored-record privilege escalation — those scopes are not yet
  enforced because the features (record ownership, ranks-in-CAD) are not built.
- Civilian→officer escalation — no civilian portal yet; roles gate CAD.
- Record modification after approval / audit-history modification — no record lifecycle or
  audit-edit path exists (append-only audit table). Must be enforced when records land.
- AI access to restricted records — no AI yet.

## Immediate security actions (roadmap M1/M2)

1. Enforce `erlc:command` on the remote-command route (🔴).
2. Remove CAD read from baseline `member`; require explicit `cad.access` (🟠).
3. Return `404` on cross-tenant/not-found mutations (🟠).
4. Add webhook timestamp+nonce replay protection (🟠).
5. Extend audit coverage to all consequential CAD actions (🟡).

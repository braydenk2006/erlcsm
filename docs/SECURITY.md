# Security

Commandry treats multi-tenant isolation, credential handling, and audit integrity as first-class constraints from day one. This document describes current controls and the threat model for R0/early R1 and near-term releases.

## Current controls

| Control | Implementation |
| --- | --- |
| Auth | Better Auth sessions; magic link; optional Discord OAuth; password auth disabled |
| Secrets | Env-validated (`BETTER_AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` ≥ 32 chars) |
| Credential at rest | AES-256-GCM (`encryptSecret` / `decryptSecret`) for integration payloads |
| Authorization | Central `authorize()` with cross-tenant deny |
| Validation | Zod on org create/update/invite/switch |
| Audit | Append events; sensitive keys redacted (`[REDACTED]`) |
| Logging | Structured JSON with secret key redaction |
| Public IDs | Non-sequential IDs in API responses |
| CI | Placeholder scan blocks fake/mock production patterns |

## Threat model

### Cross-tenant data access

**Risk:** Actor reads or mutates another organization’s resources.  
**Mitigations:** Membership-scoped actor building; `authorize()` organization mismatch and resource `organizationId` checks; Prisma queries include org filters in services; listings exclude soft-deleted orgs.  
**Residual:** Every new query path must keep org predicates — no “global find by id” without membership checks.

### Privilege escalation

**Risk:** Member elevates to admin/owner or grants themselves actions.  
**Mitigations:** Role assignment gated by `role:manage` / `permission:grant`; system roles created server-side; invite role keys limited to `admin|moderator|staff|member` (not `owner`); `authorize()` is authoritative.  
**Residual:** Admin UI for role editing not fully shipped; keep server checks when it lands.

### Account-link takeover (Discord / Roblox)

**Risk:** Attacker links a victim’s Discord/Roblox identity to their Commandry account.  
**Mitigations:** Schema enforces unique external IDs per provider; Roblox package documents official verification only (no cookie scraping).  
**Residual:** Link/verify flows are not productized yet — implement proof-of-ownership and unlink challenges before enabling.

### ER:LC abuse

**Risk:** Stolen API keys or unauthorized live commands (kick/ban/announce).  
**Mitigations:** Default `ERLC_MODE=simulator` (no live connection); secrets encrypted at rest; `erlc:command` / `erlc:manage` permissions reserved; no invented live endpoints.  
**Residual:** Live client, rate limits, and command allowlists required before enabling production commands.

### API keys & integration credentials

**Risk:** Plaintext keys in DB, logs, or audit.  
**Mitigations:** Ciphertext/iv/authTag columns; audit + logger redaction patterns for token/secret/api_key fields.  
**Residual:** Key rotation UI and scoped API keys for public API are not built.

### Uploads / object storage

**Risk:** Malicious files, path traversal, cross-tenant object access.  
**Mitigations:** S3 env optional; no upload API in R0/R1.  
**Residual:** When added — content-type allowlists, size limits, virus scanning strategy, tenant-prefixed object keys, signed URLs.

### Prompt injection (AI)

**Risk:** Retrieved docs or user content instruct the model to exfiltrate data or take privileged actions.  
**Mitigations:** `DEFAULT_AI_SAFETY_POLICY` — human confirmation for writes, label AI output, respect document permissions, forbid autonomous discipline; `AI_PROVIDER=none` by default.  
**Residual:** Tool sandboxing, retrieval ACL enforcement, and output filtering must ship with Release 8 features.

### Webhook replay

**Risk:** Replayed Stripe/Discord/integration webhooks mutate state twice.  
**Mitigations:** No webhook receivers implemented yet; plan signature verification + idempotency keys + timestamp windows.  
**Residual:** Implement before enabling Stripe or inbound Discord interactions.

### Billing bypass

**Risk:** Clients claim paid plan features without payment.  
**Mitigations:** `planKey` stored server-side; `PLAN_LIMITS` constants exist but are not yet enforced on every path.  
**Residual:** Server-side entitlement checks + Stripe webhook verification required before monetization.

### Support impersonation abuse

**Risk:** Platform staff access tenant data without consent or audit.  
**Mitigations:** `SupportAccessSession` schema with reason/time bounds; platform roles distinct from org roles; audit source `PLATFORM_SUPPORT`.  
**Residual:** Product UI/API for granting/revoking support access not shipped — do not improvise ad-hoc impersonation.

### Audit tampering

**Risk:** Attackers delete or alter audit rows to hide actions.  
**Mitigations:** Append-only application API (`recordAuditEvent` create only); sanitization prevents secret leakage; org delete sets FK null rather than cascading audit wipe.  
**Residual:** DB-level immutability (roles/triggers), hash chaining, and export integrity still planned.

### IDOR (insecure direct object reference)

**Risk:** Guessable or leaked IDs grant access without authz.  
**Mitigations:** Public IDs are non-sequential; services call `authorize()`; invitation acceptance requires matching signed-in email.  
**Residual:** Continuous review of new routes for “fetch by id → return” without membership checks.

### Job duplication / poisoned workers

**Risk:** Duplicate BullMQ jobs double-apply side effects; malicious payloads escalate.  
**Mitigations:** Minimal system jobs today (`health.check`, `demo.echo`); failures recorded; Redis not exposed publicly in compose by default intent.  
**Residual:** Idempotent job keys, payload validation, and least-privilege worker credentials before notification/integration queues go live.

## Reporting

Security issues should be reported privately to the maintainers. Do not file public issues with exploit details for live deployments.

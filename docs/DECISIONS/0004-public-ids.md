# 0004. Public IDs

Date: 2026-08-02  
Status: Accepted

## Context

Exposing sequential or raw internal database IDs in URLs and APIs aids scraping, accidental leakage correlation, and IDOR probing. Commandry APIs need stable external identifiers that are unique and opaque.

## Decision

Use **prefixed public IDs** generated with cuid2 (`createPublicId(prefix)` in `@commandry/shared`):

Examples: `org_…`, `usr_…`, `mem_…`, `role_…`, `inv_…`, `aud_…`, `req_…`

- Internal primary keys remain cuid strings for Prisma/Better Auth compatibility
- `publicId` columns are `@unique` and preferred in API JSON (`id` in org responses maps to `publicId`)
- Generation hooks assign `publicId` on user create (auth) and org/invite/audit create (services)

## Consequences

**Positive**

- Non-sequential, namespaced identifiers in clients
- Easier log/support triage by prefix
- Internal IDs can stay server-side for joins

**Trade-offs**

- Dual-ID lookups (`publicId` or internal `id`) must be handled carefully in services
- Prefix vocabulary must stay consistent across packages
- Slightly longer IDs in URLs (acceptable for SaaS admin surfaces)

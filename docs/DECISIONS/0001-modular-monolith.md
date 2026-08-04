# 0001. Modular monolith

Date: 2026-08-02  
Status: Accepted

## Context

Commandry needs strong multi-tenant isolation, shared authorization/audit, and many domain modules (staff, CAD, ER:LC, Discord). A distributed microservices start would slow R0/R1 and complicate transactional consistency across memberships, roles, and audit.

## Decision

Build a **modular monolith**:

- Deployable apps: `web`, `worker`, `discord-bot`
- Domain and platform code in versioned workspace packages
- Single PostgreSQL database with tenant columns
- Clear package boundaries so modules can be extracted later if needed

## Consequences

**Positive**

- One migration pipeline and shared `authorize()` / audit libraries
- Faster local DX (`pnpm dev` via Turborepo)
- Easier cross-module transactions during early product discovery

**Trade-offs**

- Requires discipline so packages do not become a tangled ball of mud
- Scaling is vertical/process-based first (web vs worker), not per-domain services
- Discord bot remains a separate process for gateway concerns without splitting the data plane

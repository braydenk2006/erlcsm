# Ordinex — Beta Release Readiness

- **Release candidate**: none cut yet.
- **Branch**: `cursor/ordinex-rebrand-live-erlc-6056`.
- **Production build**: green (`pnpm build` / `pnpm quality` pass).
- **Database migrations**: all applied cleanly (additive across phases).
- **This increment**: navigation/IA consolidation into 7 workspaces (Program §1), verified in
  production with no regressions.

## Final recommendation

```
NOT READY FOR CLOSED BETA
```

The product breadth is large and tested, and the navigation is now consolidated into one coherent
experience. But the Final Platform Completion Program's launch-critical operational systems are not
yet implemented. Closed beta should not begin until the blockers below are done and verified.

## Beta blockers (prioritized, must-do before closed beta)

1. **Billing & subscription operations (§2)** — payment provider (Stripe) abstraction, checkout,
   activation, upgrade/downgrade (downgrade-safe entitlement behavior already exists), cancellation,
   customer portal, invoices, signature-verified idempotent webhooks + reconciliation. _Without this
   there is no way to take money or drive Growth/Enterprise entitlements from real payments._
2. **Ordinex Staff Panel + isolation (§3, §21)** — `/staff` gated by server-verified `platformRole`
   (customers, org owners, and enterprise owners must be blocked), overview, customer/org lookup with a
   sensitive-content boundary. Foundation exists (`platformRole`, `platform:*`, `SupportAccessSession`).
   _Without this the team cannot operate or support the platform._
3. **Customer support ticket system (§4)** — categories, priority, status, assignment, internal notes
   (never customer-visible), timeline, macros, SLA. _Beta customers need a real support channel._
4. **Controlled support sessions (§6)** — start-with-reason/scope/duration, read-only default, visible
   banner, auto-expiry, full audit; no silent impersonation. Builds on `SupportAccessSession`.
5. **Transactional email (§11)** — provider abstraction + queued delivery + dev capture, wired to magic
   link, invitations, application/shift/training/billing/support notifications.
6. **Data export / deletion / retention (§12)** — user + org export, deletion lifecycle with grace
   period + audit. _Privacy baseline for onboarding real customers._
7. **Security attack-test pass (§9.1)** — the explicit cross-tenant IDOR/BOLA, staff-privilege-escalation,
   CSRF/XSS/SSRF/injection, webhook/billing replay, API-key, and AI/knowledge/RMS retrieval tests, with
   documented findings + fixes.
8. **Tested deployment + backup/restore (§20)** — deployment/rollback/backup/restore/incident/launch
   docs, with an actually-executed backup + restore (not just written).

## Should-do (strongly recommended before or shortly after beta)

9. Internal incident management (§7) + platform admin tools + feature flags (§8).
10. Observability alerting completion (§10) and a staff-panel health summary.
11. PWA verification + mobile audit fixes (§14); accessibility WCAG 2.2 AA audit (§19).
12. Onboarding setup-health checklist (§13); performance/load baselines (§18).
13. Regenerate the public Plans page + feature matrix from verified capability config (§15–16) and
    scrub any inaccurate claims.

## What is already solid (not blockers)

Identity/orgs/members/departments/permissions/entitlements, notifications/announcements, ER:LC
(simulator) + Integration Hub, CAD, RMS (relationships/timeline/evidence + chain of custody),
Operational Time (verified private-server minutes), Workflow, Community website, Automation, Command
Center, Insights, Knowledge + grounded AI, and now the consolidated 7-workspace navigation — all
tested and prod-verified.

## Honest scope note

The Final Platform Completion Program is a multi-workstream effort (billing, staff panel, support,
incidents, hardening, email, privacy, deployment). This increment completed its explicit
first-and-foremost objective (navigation consolidation) and produced this honest readiness assessment;
the remaining blockers above are the concrete path to a closed-beta RC.

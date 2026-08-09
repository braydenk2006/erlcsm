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

## Completed since the last assessment

- ✅ **Ordinex Staff Panel + isolation (Blocker 2)** — `/staff` gated by server-verified `platformRole`
  (org owners / enterprise owners denied), overview, customer/org search + support profiles (safe
  fields only), user profiles (no secrets). Tested + prod-verified.
- ✅ **Customer support ticket system (Blocker 3)** — categories/priority/status/assignment, customer
  replies, **internal notes never shown to customers**, macros, a staff console + a customer
  `/app/support` page (under Administration, not a new global workspace). Tested.
- ✅ **Controlled support sessions (Blocker 4)** — reason/scope/duration, **read-only default**, elevated
  gated to ADMIN+, auto-expiry, revocation, full audit (`PLATFORM_SUPPORT`), tenant-scoped, customer
  access history. Tested.
- ✅ **Security attack-test pass (Blocker 7) — partial** — platform-staff isolation, support-session
  escalation, internal-note isolation, and cross-tenant IDOR checks are automated + passing (see
  `docs/security/PRE_BETA_SECURITY_REVIEW.md`). Remaining: automated CSRF/XSS/SQLi suite + rate-limit
  sweep.

## Remaining beta blockers (prioritized)

1. **Billing & subscription operations (Blocker 1)** — Stripe provider abstraction, checkout, activation,
   upgrade/downgrade (downgrade-safe entitlement behavior already exists), cancellation, customer
   portal, invoices, signature-verified idempotent webhooks + reconciliation. _Requires live Stripe
   keys not available in this environment._
2. **Transactional email (Blocker 5)** — provider abstraction + queued delivery + dev capture, wired to
   magic link, invitations, application/shift/training/billing/support notifications.
3. **Data export / deletion / retention (Blocker 6)** — user + org export, deletion lifecycle with grace
   period + audit.
4. **Security attack-test pass — finish (Blocker 7)** — the outstanding automated CSRF/XSS/SQLi/
   mass-assignment suite + rate-limit/race sweep, plus billing-webhook-replay once billing exists.
5. **Tested deployment + backup/restore (Blocker 8)** — deployment/rollback/backup/restore/incident/
   launch docs, with an actually-executed backup + restore.

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

# Plans — Missing / Incomplete Features Report

Every advertised or requested plan capability that is **not** fully implemented, grouped into
logical future work packages. Complexity: S(mall) / M(edium) / L(arge) / XL. Status matches
`FEATURE_VERIFICATION_MATRIX.md`. These are **not** built in this task (which delivers the plan +
entitlement architecture); they are entitlement-ready — when built they light up automatically.

Cross-cutting requirements for every item below: tenant isolation, server-side permission +
**entitlement** enforcement (`requireFeature`/`assertWithinLimit`), input validation, error/empty/
loading states, and tests.

## Update — Start-Up Phases 2–3 shipped

Now **Verified Complete** and removed from the lists below: `core.members`, `core.departments`,
`core.notifications`, `announcements.management` (Phase 2) and `roblox.account_linking` (Phase 3).
Also reclassified from Verified → **Partial** (simulator-only; live PRC ER:LC API has no data):
`server.locations`, `server.wanted_status`.

Remaining Start-Up work (Phases 4–9) is enumerated in `STARTUP_COMPLETION_REPORT.md`:
shifts/activity/sessions; applications/forms/training; documents + website builder + public staff
directory; Start-Up AI (report/application summaries); dedicated MDT + incident/arrest report
workflows + basic CAD analytics; mobile + PWA/offline.

## Group A — CAD expansion (Growth)

| Feature                             | Key                                              | Status  | What exists                              | What's missing                                                                | Complexity |
| ----------------------------------- | ------------------------------------------------ | ------- | ---------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| Advanced dispatch                   | `cad.dispatch.advanced`                          | Missing | Basic dispatch board                     | reassign/transfer/merge/split, dispositions, saved layouts, shortcuts, alerts | L          |
| Advanced dispatch analytics         | `cad.analytics.advanced`                         | Missing | Priority distribution only               | response-time reporting, unit activity, saved reports                         | M          |
| Court system                        | `cad.court`                                      | Missing | —                                        | cases/judges/hearings/motions/verdicts/appeals models + UI                    | XL         |
| Evidence locker                     | `cad.evidence`                                   | Missing | —                                        | evidence model + media storage + UI                                           | L          |
| Chain of custody                    | `cad.chain_of_custody`                           | Missing | —                                        | append-only custody ledger + transfers                                        | M          |
| Fire / EMS                          | `cad.fire_ems`                                   | Missing | Unit-type enums                          | apparatus, incidents, PCR, transports, facilities                             | XL         |
| Civilian portal                     | `cad.civilian_portal`                            | Missing | —                                        | civilian self-service surface with strict permission separation               | L          |
| Character management                | `cad.characters`                                 | Missing | `CadCivilian` conflates person/character | person↔character split + ownership                                            | M          |
| Business / property registry        | `cad.business_registry`, `cad.property_registry` | Missing | —                                        | registries + UI                                                               | M each     |
| Fleet management                    | `cad.fleet`                                      | Missing | —                                        | fleet model + assignment                                                      | M          |
| Detective case management           | `cad.detective`                                  | Missing | —                                        | case model + linking                                                          | L          |
| Multi-agency dispatch               | `cad.multi_agency`                               | Partial | Agencies model                           | supporting agencies per call, mutual aid                                      | M          |
| Unit recommendations                | `cad.unit_recommendations`                       | Missing | Domain helper unused                     | recommendation surface                                                        | M          |
| Live unit tracking                  | `cad.live_unit_tracking`                         | Missing | —                                        | real-time unit positions (needs real-time infra)                              | L          |
| PDF export / digital signatures     | `cad.pdf_export`, `cad.digital_signatures`       | Missing | —                                        | PDF renderer + signature/attestation                                          | M          |
| MDT (dedicated)                     | `cad.mdt`                                        | Partial | Dispatch detail panel                    | mobile-first MDT surface, lookups, offline drafts                             | L          |
| Incident / arrest reports (fielded) | `cad.incident_reports`, `cad.arrest_reports`     | Partial | Record types                             | typed fields, workflows                                                       | M          |

## Group B — Server management expansion (Growth)

| Feature                                           | Key                                                         | Status                                | Complexity |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------- | ---------- |
| Advanced remote commands / custom command builder | `server.remote_commands.advanced`, `server.custom_commands` | Missing                               | M          |
| Moderator-call dashboard                          | `server.moderator_calls`                                    | Missing                               | M          |
| Queue monitoring                                  | `server.queue_monitoring`                                   | Missing (ER:LC queue endpoint exists) | S          |
| Emergency-call automation                         | `server.emergency_call_automation`                          | Missing                               | M          |
| Live heatmaps                                     | `server.live_heatmaps`                                      | Missing                               | M          |

## Group C — Community management expansion (Start-Up/Growth)

Applications (`applications.*`), Training (`training.*`), Forms (`forms.*`), Sessions
(`sessions.management`), Activity (`activity.tracking`), Announcements, Shifts, Documents
(`documents.*`, `knowledge_base`), Workflows/Automations (`workflows.builder`,
`automations.builder`), People-ops (`performance.reviews`, `leave.management`,
`recognition.management`) — all currently **placeholder module pages**. Each needs full data
model + UI + workflows. Complexity M–L each; this is the largest missing surface.

## Group D — AI expansion (Growth/Enterprise)

All `ai.*` capabilities are **Missing** (AI_PROVIDER defaults to `none`; `@commandry/ai` is
policy constants only). Requires the shared AI framework, per-org monthly request enforcement
(scaffolded via `ai_requests.monthly` limit + usage counters), and permission/entitlement-aware
tool calls. Complexity L overall; AI must remain advisory and never approve/issue/execute.

## Group E — Analytics expansion (Growth)

`analytics.basic/advanced/custom_dashboards/scheduled_reports` — Missing. Needs an analytics
read-model + dashboard builder + scheduled-report worker. Complexity L.

## Group F — Website expansion (Start-Up/Growth/Enterprise)

`website.builder` (Missing), `website.unlimited_pages`, `website.custom_domains` (model
`OrganizationDomain` exists, no flow), `website.white_label` — Missing. Complexity L; needs a
page builder + publishing + `website_pages.max` enforcement.

## Group G — Enterprise security

`security.mfa_policy` (schema-ready, unenforced), `security.ip_restrictions`,
`security.custom_retention`, `security.backup_scheduling`, `security.disaster_recovery` — Missing.
**`security.sso` — Missing and intentionally NOT advertised in any plan** (identified here per the
requirement). Complexity M–L.

## Group H — Enterprise administration

`enterprise.multi_organization`, `enterprise.cross_community_staff`,
`enterprise.global_permissions`, `enterprise.global_policies`, `enterprise.centralized_analytics`,
`enterprise.bulk_import`, `enterprise.bulk_export` — Missing. Complexity L–XL; multi-org changes
the tenancy surface and must not destabilize single-org behavior.

## Group I — Integrations & developer platform

`api.public`, `api.advanced`, `webhooks.basic/advanced`, `integrations.custom` — Missing. The
only integration surfaces today are the ER:LC client and an inbound ER:LC webhook. Needs a public
API (keys, scopes, rate limits via `api_requests.monthly`), outgoing webhooks, and delivery
workers. Complexity L. Future Zapier/Make are **not** advertised.

## Support (operational, Coming Soon)

`support.priority`, `support.migration`, `support.guided_onboarding`, `support.account_management`
are operational commitments, not code. Shown as **Coming Soon** / "Enterprise onboarding" on the
Plans page until the service exists.

## Recommended future prompts

1. CAD expansion — Group A (evidence, court, fire/EMS, civilian portal, advanced dispatch).
2. Community management build-out — Group C (applications, training, forms, documents, workflows).
3. AI framework + enforcement — Group D.
4. Analytics + scheduled reports — Group E.
5. Website builder + custom domains — Group F.
6. Enterprise security — Group G (incl. SSO).
7. Enterprise administration / multi-org — Group H.
8. Public API + webhooks — Group I.
9. Real-time infrastructure (unblocks live unit tracking, moderator calls, heatmaps).

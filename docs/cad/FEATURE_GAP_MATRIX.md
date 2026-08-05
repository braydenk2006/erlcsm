# CAD/MDT — Feature Gap Matrix

Status legend: **Complete** · **Partial** · **Missing** · **Mocked** · **Unsafe** ·
**Redesign** (needs redesign) · **Blocked** (by external ER:LC API).

Evidence points to routes/services/models/tests. "Live" = simulator-backed today.

## Dispatch

| Feature                    | Status   | Evidence / note                                                |
| -------------------------- | -------- | -------------------------------------------------------------- |
| Real-time call board       | Missing  | `dispatch-view.tsx` polls every 8s; no subscriptions           |
| Real-time unit board       | Missing  | same polling                                                   |
| Unit recommendations       | Missing  | `isAvailableForDispatch` exists in domain, unused              |
| Multiple assigned units    | Complete | `CadCallUnit` join; assign/unassign routes                     |
| Multi-agency calls         | Missing  | `CadCall.agencyId` single; no supporting agencies              |
| Mutual aid                 | Missing  | —                                                              |
| Call transfer              | Missing  | —                                                              |
| Call merging               | Missing  | —                                                              |
| Call splitting             | Missing  | —                                                              |
| Call reopening             | Partial  | domain allows CLOSED→PENDING; no UI/route                      |
| Dispatcher handoff         | Missing  | —                                                              |
| Supervisor view            | Missing  | —                                                              |
| Call dispositions          | Partial  | `disposition` column exists; no UI/route                       |
| Call timers                | Partial  | `dispatchedAt`/`clearedAt` captured; not displayed             |
| Response-time tracking     | Partial  | `responseTimes()` in domain; not surfaced/persisted-as-metrics |
| Audible alerts             | Missing  | —                                                              |
| Configurable priorities    | Partial  | priority is 1–5 int; labels not configurable                   |
| Configurable call types    | Missing  | free-text `type`; no config                                    |
| Saved dispatcher layouts   | Missing  | —                                                              |
| Keyboard shortcuts         | Missing  | —                                                              |
| Emergency/panic handling   | Partial  | `PANIC` unit status only; no workflow/alert                    |
| ER:LC emergency-call dedup | Partial  | upsert on `(org,source,externalId)`; sim ids change per tick   |
| Moderator-call integration | Missing  | —                                                              |
| Stale-call reconciliation  | Missing  | —                                                              |

## Unit management

| Feature                           | Status   | Evidence / note                                       |
| --------------------------------- | -------- | ----------------------------------------------------- |
| Single-person units               | Complete | `CadUnit`                                             |
| Multi-person units                | Missing  | one `name`; no officer roster                         |
| Unit partners                     | Missing  | —                                                     |
| Unit supervisors                  | Missing  | —                                                     |
| Fire apparatus                    | Missing  | `CadUnitType.FIRE` enum only                          |
| EMS units                         | Missing  | `CadUnitType.EMS` enum only                           |
| Specialized units                 | Missing  | —                                                     |
| Vehicle assignment                | Missing  | —                                                     |
| Equipment assignment              | Missing  | —                                                     |
| Certifications                    | Missing  | —                                                     |
| Department/agency assignment      | Partial  | `agencyId`/`membershipId` columns exist, unused in UI |
| Callsign validation               | Missing  | free text                                             |
| Duplicate callsign prevention     | Missing  | no unique constraint                                  |
| Unit-status history               | Missing  | only `lastStatusAt`                                   |
| Duty history                      | Missing  | —                                                     |
| Shift integration                 | Missing  | Ordinex `Shift` not linked                            |
| Session integration               | Missing  | Ordinex `Session` not linked                          |
| Panic state                       | Partial  | status value only                                     |
| Offline/stale handling            | Missing  | —                                                     |
| Auto-unit from live ER:LC players | Missing  | player-history exists; no unit creation               |

## MDT

| Feature                  | Status   | Evidence / note                                 |
| ------------------------ | -------- | ----------------------------------------------- |
| Assigned-call view       | Partial  | dispatch detail panel; no dedicated MDT surface |
| Unit-status actions      | Complete | `units/[id]` PATCH                              |
| Person lookup            | Partial  | `civilians?q=`; no person/character split       |
| Character lookup         | Redesign | `CadCivilian` conflates person/character        |
| Vehicle lookup           | Complete | `vehicles?q=`                                   |
| Plate lookup             | Complete | plate search                                    |
| Address lookup           | Missing  | —                                               |
| Warrant lookup           | Partial  | list only, no unified search                    |
| BOLO lookup              | Partial  | list only                                       |
| Report lookup            | Missing  | —                                               |
| Citation creation        | Complete | `records` POST (CITATION)                       |
| Warning creation         | Complete | records (WARNING)                               |
| Arrest creation          | Complete | records (ARREST)                                |
| Incident-report creation | Partial  | records (INCIDENT), no fields/workflow          |
| Crash report             | Missing  | —                                               |
| Tow report               | Missing  | —                                               |
| Use-of-force report      | Missing  | —                                               |
| Fire report              | Missing  | —                                               |
| Patient-care report      | Missing  | —                                               |
| Recent searches          | Missing  | —                                               |
| Favorites                | Missing  | —                                               |
| Quick actions            | Partial  | preset command chips in dispatch console        |
| Tablet usability         | Partial  | responsive grid                                 |
| Mobile usability         | Partial  | responsive; not MDT-optimized                   |
| PWA behavior             | Partial  | manifest exists; no offline/install-tuned MDT   |
| Offline draft handling   | Missing  | —                                               |

## Records management

| Feature                                                                   | Status  | Evidence / note                                            |
| ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| Draft / Submitted / Review / Revision / Approve / Reject / Lock / Archive | Missing | `CadRecord` has no status; `REPORT_STATES` machine unwired |
| Multiple authors                                                          | Missing | single `officerName`                                       |
| Signatures / attestations                                                 | Missing | —                                                          |
| Attachments                                                               | Missing | —                                                          |
| Record numbering                                                          | Missing | `publicId` only, no human number                           |
| Configurable fields                                                       | Missing | —                                                          |
| Configurable record types                                                 | Missing | fixed enum                                                 |
| Record history                                                            | Missing | —                                                          |
| Immutable approved-record history                                         | Missing | no lock; also no update route yet                          |
| Amendments                                                                | Missing | —                                                          |
| PDF export / print view                                                   | Missing | —                                                          |
| Related calls/units/persons/vehicles/evidence                             | Partial | civilian link only                                         |
| Search indexing                                                           | Missing | —                                                          |

## Warrants

| Feature                                | Status   | Evidence / note                                      |
| -------------------------------------- | -------- | ---------------------------------------------------- |
| Arrest / Search / Bench / Custom types | Missing  | single implicit type                                 |
| Draft→approval workflow                | Missing  | created straight to ACTIVE; `WARRANT_STATES` unwired |
| Judicial/supervisory review            | Missing  | —                                                    |
| Probable-cause narrative               | Partial  | `reason` free text                                   |
| Scope                                  | Missing  | —                                                    |
| Charges                                | Complete | `charges[]`                                          |
| Expiration                             | Partial  | `EXPIRED` status value; no `expiresAt`/job           |
| Service                                | Missing  | —                                                    |
| Recall                                 | Partial  | "clear" only (Redesign: not lifecycle)               |
| Denial                                 | Missing  | —                                                    |
| Dismissal                              | Missing  | —                                                    |
| Notifications                          | Missing  | —                                                    |
| History                                | Missing  | —                                                    |
| Automatic expiration job               | Missing  | —                                                    |
| Reconciliation after downtime          | Missing  | —                                                    |

> "Clear department-wide" is **not** a substitute for per-warrant lifecycle — flagged Redesign.

## BOLOs

| Feature                              | Status   | Evidence / note         |
| ------------------------------------ | -------- | ----------------------- |
| Person / Vehicle                     | Complete | `CadBoloType`           |
| Plate / Property / Weapon / Location | Missing  | —                       |
| Priority                             | Missing  | —                       |
| Expiration                           | Missing  | no `expiresAt`          |
| Acknowledgment                       | Missing  | —                       |
| Match alerts                         | Missing  | no lookup-time matching |
| Search integration                   | Missing  | —                       |
| MDT / dispatch alerts                | Missing  | —                       |
| Linked reports                       | Missing  | —                       |
| Status history                       | Missing  | ACTIVE/CLEARED only     |
| Automatic expiration                 | Missing  | —                       |

## Evidence

**Missing** entirely. No model, routes, or chain-of-custody. Report attachments do not exist
either, so nothing misrepresents evidence.

## Civilian portal

**Missing**. No civilian self-service surface. Note (Unsafe-adjacent): the baseline `member`
role currently grants read-only CAD (`cad.people.view`, `cad.vehicles.view`), so a plain
member can read CAD records — see Security Review.

## Fire & EMS

**Missing** as workflows (only `CadUnitType.FIRE/EMS` enum values). No apparatus, incidents,
PCR, transports, facilities, hazmat, rescue, mutual aid, medical-privacy permissions.

## Court

**Missing** entirely.

## Penal code

| Feature                                    | Status   | Evidence / note                       |
| ------------------------------------------ | -------- | ------------------------------------- |
| Tenant-customizable                        | Missing  | `PENAL_CODE` is a code constant       |
| Categories / charges / fines / jail        | Partial  | present in the constant, not editable |
| Points / enhancements / attempted          | Missing  | —                                     |
| Multiple charges                           | Complete | `charges[]` on records/warrants       |
| Effective dates / archived / dept-specific | Missing  | —                                     |
| Import/export / version history            | Missing  | —                                     |

> A hard-coded catalogue is **not sufficient** — flagged Redesign for tenant config.

## Live map

| Feature                                | Status                     | Evidence / note                                               |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| ER:LC map rendering                    | Partial                    | `erlc-map.tsx` exists on the **Live Server** page, not in CAD |
| Player locations                       | Partial (Blocked for live) | simulator provides x/y; PRC API has none                      |
| Unit locations                         | Missing                    | —                                                             |
| Emergency-call markers                 | Missing                    | —                                                             |
| Postal/street search                   | Missing                    | —                                                             |
| Building/landmark                      | Missing                    | —                                                             |
| Filters / freshness / stale handling   | Missing                    | —                                                             |
| Permission-based visibility            | Missing                    | —                                                             |
| Marker clustering / trails / retention | Missing                    | —                                                             |

## Real-time architecture

**Missing / Redesign.** Current updates are `setInterval` API polling. No tenant-isolated
subscriptions, permission-aware channels, reconnection, event ordering/dedup, optimistic
updates, or conflict handling. Concurrent multi-dispatcher editing is last-write-wins.

## Permissions

| Feature                                                                                  | Status   | Evidence / note                                    |
| ---------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| Server-side enforcement on all CAD routes                                                | Complete | `requireCadPermission` on every `/api/cad/*` route |
| Dispatch/calls/units/MDT/people/vehicles/records/warrants/BOLOs/config/analytics actions | Complete | granular `cad.*` actions                           |
| Evidence / court / fire-EMS / civilian actions                                           | Partial  | actions defined, features absent                   |
| Department / agency / authored-record / rank / record-type scopes                        | Missing  | only org + role enforced                           |

## Audit logging

| Event                                   | Status                                        |
| --------------------------------------- | --------------------------------------------- |
| Call creation / closure                 | Complete                                      |
| Warrant creation                        | Complete                                      |
| Unit assignment / status change / panic | Missing                                       |
| Person / vehicle updates                | Missing                                       |
| BOLO create/clear                       | Missing                                       |
| Record submission / approval            | Missing (no lifecycle)                        |
| Evidence transfers                      | Missing (no evidence)                         |
| Configuration changes                   | Missing                                       |
| ER:LC imports / remote commands         | Missing (command route also under-authorized) |
| AI actions                              | Missing (no AI)                               |

## Tenant configuration

Configurable today: enabled/version/enabled-sections/default-landing/call-number-prefix
(`CadSettings`), and agencies (model only). **Missing config:** unit types, callsigns, status
codes, priorities, call types, dispositions, penal codes, record types, required fields,
warrant types, BOLO types, number formats, approval chains, retention policies, map settings.

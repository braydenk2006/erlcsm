# Enterprise Records Management System (RMS) — Phase 11

The RMS is the **authoritative operational record layer**. It is not a bigger CAD — CAD is one input;
the RMS makes every operational object (case, evidence, person, vehicle, property, court case, jail
booking, detective case, IA complaint, fleet vehicle, fire/EMS record, business, address) a
**connected, timelined, relatable record**. Nothing exists in isolation. It reuses every existing
Ordinex platform (Workflow, Automation, Insights, Command Center, Knowledge, AI) instead of
reinventing them.

## 1. Architecture

- **`@commandry/rms`** (pure, 8 tests): the record-type registry (each type declares its
  view/manage permission and whether it has a concrete table or is generic), case + evidence
  lifecycles, an **immutable chain-of-custody** model + integrity validator, the relationship-engine
  vocabulary (relations + inverses), and the timeline-engine helpers.
- **DB**: concrete tables for the highest-volume records (`RmsCase`, `RmsEvidence` + append-only
  `RmsCustodyEvent`, `RmsPerson`, `RmsVehicle`, `RmsProperty`) and a generic `RmsRecord` for the
  remaining modules — all uniform in the Relationship Engine (`RmsLink`) and Timeline Engine
  (`RmsTimelineEvent`). `RmsSequence` gives per-org monotonic record numbers.
- **Service** `@commandry/api/rms`: Relationship Engine, Timeline Engine, Case Management, Evidence +
  chain of custody, person/vehicle/property + generic record CRUD, Global Search, and RMS metrics.

## 2. Unified Relationship Engine

`RmsLink` links **any** record to **any** other record with a typed relation. `link`/`unlink`/
`getRelationships` resolve the linked record's number/title/href and are **permission-aware** — a user
only ever sees links to record types they may view. Navigation is bidirectional: opening a case shows
its evidence, suspects, court case, etc.; opening the person shows the same case from the inverse
side (`Suspect in` ↔ has-suspect). Every link writes a timeline event on both records.

## 3. Case Management

`RmsCase` with the full status lifecycle (`OPEN → ACTIVE → PENDING → AWAITING_EVIDENCE →
AWAITING_REVIEW → AWAITING_COURT → CLOSED → ARCHIVED`, enforced transitions; ARCHIVED terminal).
Each case exposes its **timeline**, **narrative** (append-only, timestamped entries), linked evidence,
and relationships. Emits `Case.Created` / `Case.Closed` onto the Automation bus.

## 4. Evidence + immutable chain of custody

`collectEvidence` creates a numbered evidence record (status `COLLECTED`), opens the chain of custody
(sequence 1 = `COLLECT`), and auto-links it to its case (`evidence_for`). `applyCustody`
(`TRANSFER`/`CHECK_OUT`/`RETURN`/`RELEASE`/`ARCHIVE`/`DESTROY`) appends a new custody event — the
`RmsCustodyEvent` rows are **append-only** (no update/delete path) with a unique `(evidence,
sequence)`. Each event records transferred-from/to, reason, condition, signature, notes, and
timestamp. `getCustodyChain` returns the ordered chain plus a deterministic **integrity check**
(begins with COLLECT, monotonic sequence + non-decreasing time, transfers name a recipient). Illegal
actions (e.g. RETURN when not checked out, any action on DESTROYED) are rejected. Emits
`Evidence.Collected` / `Evidence.CheckedOut` / `Evidence.Returned`.

## 5. Timeline Engine

Every subsystem writes `RmsTimelineEvent`s; `getTimeline` returns one chronological (newest-first)
timeline per record — created, status changes, narrative entries, links, evidence collection, custody
transfers, closures. Timeline integrity is covered by tests.

## 6. Modules (Court, Jail, Detective, Internal Affairs, Fleet, Fire/EMS, Business, Address)

These are first-class **generic records** (`RmsRecord`) — numbered, statused, JSON-detailed, and
fully participating in relationships, timeline, search, and permissions. Court/IA approvals reuse the
**Workflow Platform** via the built-in Document/General approval workflows (a `workflowSubmissionId`
links a record to its approval submission). Creating a court case emits `Court.Scheduled`.

## 7. Global Search

`searchRms` searches cases, evidence, persons, vehicles, properties, and every generic module,
**permission-scoped** per record type and tenant-isolated. It is token-aware, so a natural-language
question ("find case CASE-2026-000123") still matches the record number — which is exactly how the AI
retrieves operational records.

## 8. Integrations (reuse, not reinvention)

- **Automation Platform**: RMS events (`Case.Created`, `Case.Closed`, `Evidence.Collected`,
  `Evidence.CheckedOut`, `Evidence.Returned`, `Court.Scheduled`) are published onto the existing event
  bus and consumable by any automation.
- **AI Assistant**: the AI retrieval pipeline now includes permission-scoped RMS records as a citation
  kind (`record`); the assistant cites cases/evidence/records and **never fabricates** operational
  facts (grounded provider; tested).
- **Insights + Command Center**: `getRmsMetrics` (open cases, evidence awaiting review, court backlog,
  jail population, IA cases, avg investigation time) feeds a Command Center **Records (RMS)** widget.
- **Identity / Operational Time / Workflow / Knowledge**: users, permissions, workflow approvals, and
  cited knowledge are all reused, not duplicated.

## 9. Permissions (server-side)

`rms.view`, `cases.view/create/edit/archive`, `evidence.manage`, `records.manage`, and per-module
`court.manage`, `jail.manage`, `detective.manage`, `internal_affairs.manage`, `fleet.manage`,
`fire.manage`, `ems.manage`, `civilian_portal.manage`. Each record type declares its own view/manage
permission in the registry; enforcement is entirely server-side and tenant-isolated.

## 10. Web

`/app/rms` console: RMS metric strip, **Cases** (create → case detail with status transitions,
narrative, evidence collection, custody actions + integrity, relationships, and timeline), **Global
Search**, and **Modules** (create any of the module record types). Mobile-friendly responsive layout.

## Extension points (no redesign required)

New record types register in the domain registry + get a permission; new relations extend `RELATIONS`;
new timeline/automation events add to their registries. Future body-camera / computer-vision / LPR /
OCR / external evidence storage / GIS integrations attach as evidence attachments + linked records +
timeline events through the same generic model.

## Testing

Unit (8): registry + permissions, case lifecycle transitions, custody action→status + illegal-action
guards + **append-only chain integrity**, relationship labels/inverses, timeline ordering. Integration
(9, real DB): case creation (numbered + timelined + `Case.Created`), evidence collection + auto-link +
`Evidence.Collected`, immutable valid chain of custody through actions + illegal-action rejection,
cross-type relationship navigation (person↔case, bidirectional), permission-scoped global search,
generic module records (`Court.Scheduled`), status-transition enforcement + `Case.Closed`, AI citing
operational records without fabrication, and tenant isolation.

## Known limitations / follow-ups

- Modules beyond Case/Evidence use the generic record model with a console create + link/search/
  timeline; bespoke per-module forms (court hearings, jail housing, fleet maintenance schedules,
  patient-care fields) are follow-ups on the same schema.
- The public **Civilian Portal** reuses the Workflow Platform + Community Experience public routing;
  its dedicated public intake UI is a follow-up (the workflow submission plumbing is in place).
- Evidence attachments/media, digital-signature capture, and GIS mapping are architected-for
  (attachment + link model) but not yet surfaced in the UI.

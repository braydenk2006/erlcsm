# Workflow Platform (Phase 5)

One reusable engine for every submission/approval process in Ordinex. Forms, Applications, and
Training are **not** separate systems — they are templates on this platform. Future processes (LOA,
promotions, evaluations, awards, complaints, vehicle requests, evidence submission, custom community
workflows) become templates without changing the architecture.

## 1. Architecture

```
Workflow Platform
├── Form Builder        (@commandry/workflow: field schema + validation)
├── Workflow Builder    (stages: approval mode + reviewer assignment)
├── Submission Engine   (draft → submit → validate → sanitize)
├── Approval Engine     (SINGLE / ALL / ANY / AUTO, revision)
├── Review/Assignment   (manual / role / department / round-robin / specific / submitter)
├── Notification Engine (shared notifications)
├── Automation Hooks    (WorkflowEvent stream)
├── Audit History       (shared audit + append-only timeline)
└── Analytics           (derived from submissions + events)
```

- Pure domain: `@commandry/workflow` — field types + `validateSubmission` (server-authoritative),
  the stage engine (`evaluateStage`, `applyOutcome`), reviewer strategy (`pickReviewer`), event
  constants, and built-in templates. Unit-tested; no DB.
- Service: `@commandry/api/workflow/service` (templates, submissions, review, comments, analytics).

## 2. Shared services (consumed, never duplicated)

Dynamic forms, workflow definitions, submission processing, multi-stage approvals, reviewer
assignment, status transitions, notifications, comments, internal notes, version history, audit
logging, and analytics. Every future module calls these — no module writes its own form storage,
approval logic, or submission model.

## 3. Dynamic form architecture

A form is `{ fields: FormField[] }`. Each `FormField` has `id`, `type` (25 types incl. text/number/
currency/email/phone/date/time/dropdown/radio/checkbox/multi-select/file/image/signature/rating/
url/toggle/user-/department-/role-select and layout headings), `required`, `placeholder`,
`helpText`, `options`, `validation` (min/max/length/pattern), and `visibleIf` (conditional
visibility). `validateSubmission` runs identically on client (UX) and server (authoritative);
`sanitizeSubmissionData` drops any injected keys not in the schema.

## 4. Workflow engine

A workflow is `{ initialStageId, stages: WorkflowStage[] }`. A stage has an `approvalMode`
(`SINGLE`/`ALL`/`ANY`/`AUTO`), an `assignment` (`MANUAL`/`ROLE`/`DEPARTMENT`/`ROUND_ROBIN`/
`SPECIFIC_USER`/`SUBMITTER` + target), `onApprove` (next stage id or `COMPLETE`), and
`allowRevision`. `evaluateStage(stage, decisions, assignedCount)` → advance/deny/revise/pending;
`applyOutcome` maps that to the next status + stage.

## 5. Approval engine

Single, multiple (ALL), any (ANY/SINGLE), auto approval; deny; revision requests. Reviewers are
assigned per stage by strategy; round-robin picks the least-loaded reviewer (`pickReviewer` over
open-assignment counts). Reassignment/manual assignment is supported. Sequential stages are the
`onApprove` chain; parallel is `ALL` (every assignee must approve).

## 6. Submission lifecycle

`DRAFT → SUBMITTED → IN_REVIEW → (REVISION_REQUESTED → resubmit → IN_REVIEW) → APPROVED/DENIED →
COMPLETED`, plus `CANCELLED`/`ARCHIVED`. Submit validates + sanitizes, assigns the initial stage's
reviewers, and (for AUTO stages like training) completes immediately. Every step appends a
`WorkflowEvent` (the timeline + automation-hook stream).

## 7. Template system

`WorkflowTemplate` bundles a form + workflow + `submitRoleKeys` + `reviewRoleKeys` + category.
Built-ins ship for application, leave, promotion, general, and training and are seeded per org
(`ensureBuiltInTemplates`). Communities create unlimited custom templates with the same shape.
Applications and Training are just templates (categories) — the same submit/review engine.

## 8. Future modules that reuse it

LOA, promotions, evaluations, awards, interview forms, complaint forms, vehicle requests, evidence
submission, disciplinary actions, ride-along requests, transfer requests — all become templates.
Adding one is data (a template), not new engine code.

## 9. APIs

- `GET/POST /api/workflow/templates` — list (by category) + create custom.
- `GET/POST /api/workflow/submissions` — list (`scope=mine|assigned|all`) + create draft.
- `GET/PATCH /api/workflow/submissions/[id]` — detail + actions (`save_draft`, `submit`, `decide`,
  `comment`, `assign`).
- `GET /api/workflow/analytics` — counts, approval rate, avg completion, template usage, reviewer
  workload.

All routes enforce authentication, membership, entitlement (`forms.basic`/`applications.basic`/
`training.basic`), permission, and tenant ownership server-side.

## 10. Events (automation hooks)

`SUBMISSION_CREATED`, `DRAFT_SAVED`, `SUBMISSION_SUBMITTED`, `REVIEWER_ASSIGNED`, `COMMENT_ADDED`,
`NOTE_ADDED`, `STAGE_CHANGED`, `REVISION_REQUESTED`, `RESUBMITTED`, `SUBMISSION_APPROVED`,
`SUBMISSION_DENIED`, `SUBMISSION_COMPLETED`, `ATTACHMENT_UPLOADED`, `DEADLINE_PASSED`,
`SUBMISSION_ARCHIVED`. The append-only `WorkflowEvent` stream is the timeline and the hook surface
for the future Automation Studio.

## 11. Permission model

Never hardcoded in templates. Each template carries `submitRoleKeys` (empty = any member) and
`reviewRoleKeys`. Managing templates requires `application:manage`; org-wide submission listing +
analytics require `application:read`; reviewing requires being an assigned reviewer or holding the
template's review role. **Internal notes are never returned to an applicant-only viewer** (server
filters comments by visibility).

## 12. Database schema

`WorkflowTemplate` (form + workflow JSON + role keys), `WorkflowSubmission` (data + status +
current stage + version), `WorkflowEvent` (timeline/hooks), `WorkflowComment` (visibility
APPLICANT/INTERNAL), `WorkflowAssignment` (stage reviewer + decision), `WorkflowAttachment`
(metadata; files served by a permission-checked endpoint, never a predictable URL).

## 13. Extension points (incl. AI readiness)

- New field types: add to `FIELD_TYPES` + a validation branch.
- New assignment strategies: add to `resolveAssignees`.
- New event consumers: subscribe to `WorkflowEvent` (Automation Studio).
- **AI readiness** (not implemented this phase): the service exposes clean read models —
  `getSubmission` (data + timeline), analytics, and the event stream — so future AI can summarize
  submissions, draft approval comments, generate evaluations, score applications, recommend
  reviewers, and detect bottlenecks **without modifying the engine**.

## Test tiers

Unit-tested (form validation, approval modes, reviewer pick, templates) and integration-tested
(validate-before-submit, single- and multi-stage approvals, AUTO training completion, internal-note
isolation, analytics). Drag-and-drop builder UI, file/signature storage, and AI are documented
follow-ups.

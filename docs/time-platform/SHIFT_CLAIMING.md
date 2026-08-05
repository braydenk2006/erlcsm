# Shift Claiming

## Policies

- **FIRST_ELIGIBLE** — the first eligible staff member claims immediately.
- **APPROVAL_REQUIRED** — the member requests; a manager (`shifts.claim.approve`) approves/denies.
- **ASSIGNED_ONLY** — only a scheduler (`shifts.assign_host`) sets the host; direct claims are rejected.

## Eligibility (server-side, `evaluateEligibility`)

Active membership, required permission, required department, and minimum rank (lower rank order =
higher rank). Future certifications/leave hooks slot into the same function. Eligibility is checked
in `claimShift` and is never trusted from the client.

## Conflict detection (`detectConflicts`)

Before claiming, the member's existing `CLAIMED/SCHEDULED/PUBLISHED/STARTING/ACTIVE` shifts are
checked for time-window overlap. A conflict blocks the claim unless an authorized override
(`shifts.assign_host`) is supplied **with a reason**, which is audited.

## Concurrency (single-host guarantee)

FIRST_ELIGIBLE claims use a conditional `updateMany` (`status = OPEN_CLAIMING AND hostMembershipId
IS NULL`) that atomically sets the host and bumps `version`. If zero rows update, another member won
the race and a `ConflictError` is returned. Integration-tested: two members racing one shift yields
exactly one host.

## Workflow + auditing

Members: view open shifts, claim / request, withdraw (before start). Managers: approve, deny,
assign, reassign, override with reason. Every claim, withdrawal, approval, denial, assignment, and
override records a `ScheduledShiftEvent` and an audit event, and notifies the affected staff member.

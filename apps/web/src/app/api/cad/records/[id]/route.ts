import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionRecord, updateRecordContent, type ReportState } from "@commandry/cad";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import type { Action } from "@commandry/permissions";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({
    action: z.literal("review"),
    decision: z.enum(["approve", "reject", "request_revision"]),
    note: z.string().max(1000).optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({ action: z.literal("lock") }),
  z.object({
    action: z.literal("update"),
    title: z.string().min(1).max(120).optional(),
    charges: z.array(z.string().max(120)).max(30).optional(),
    fineAmount: z.number().int().min(0).optional(),
    narrative: z.string().max(4000).optional(),
    expectedVersion: z.number().int().optional(),
  }),
]);

/** Record lifecycle: submit → review (approve/reject/revise) → lock, plus draft edits. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid record action");
    const body = parsed.data;

    const needed: Action =
      body.action === "review"
        ? "cad.records.review"
        : body.action === "lock"
          ? "cad.records.lock"
          : "cad.records.create";
    const { organizationId, userId } = await requireCadPermission(needed);

    let record;
    if (body.action === "update") {
      record = await updateRecordContent(
        organizationId,
        id,
        {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.charges !== undefined ? { charges: body.charges } : {}),
          ...(body.fineAmount !== undefined ? { fineAmount: body.fineAmount } : {}),
          ...(body.narrative !== undefined ? { narrative: body.narrative } : {}),
        },
        body.expectedVersion,
      );
    } else {
      const toStatus: ReportState =
        body.action === "submit"
          ? "SUBMITTED"
          : body.action === "lock"
            ? "LOCKED"
            : body.decision === "approve"
              ? "APPROVED"
              : body.decision === "reject"
                ? "REJECTED"
                : "REVISION_REQUESTED";
      record = await transitionRecord(organizationId, id, toStatus, {
        actorUserId: userId,
        note: body.action === "review" ? (body.note ?? null) : null,
        expectedVersion: body.action === "review" ? body.expectedVersion : undefined,
      });
    }

    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: body.action === "review" ? "cad.records.review" : "cad.records.create",
      resourceType: "cad_record",
      resourceId: id,
      source: "WEB",
      metadata: { action: body.action, status: record.status },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleRouteError(error);
  }
}

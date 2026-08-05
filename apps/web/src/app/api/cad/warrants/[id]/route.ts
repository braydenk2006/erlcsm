import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionWarrant, type WarrantState } from "@commandry/cad";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import type { Action } from "@commandry/permissions";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    decision: z.enum(["approve", "deny"]),
    note: z.string().max(500).optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("activate"),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
  }),
  z.object({ action: z.literal("serve"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("recall"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("dismiss"), note: z.string().max(500).optional() }),
]);

/** Warrant lifecycle transitions: review → activate → serve/recall/dismiss. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid warrant action");
    const body = parsed.data;

    const needed: Action =
      body.action === "review" || body.action === "activate"
        ? "cad.warrants.approve"
        : "cad.warrants.review";
    const { organizationId, userId } = await requireCadPermission(needed);

    const toState: WarrantState =
      body.action === "review"
        ? body.decision === "approve"
          ? "APPROVED"
          : "DENIED"
        : body.action === "activate"
          ? "ACTIVE"
          : body.action === "serve"
            ? "SERVED"
            : body.action === "recall"
              ? "RECALLED"
              : "DISMISSED";

    const warrant = await transitionWarrant(organizationId, id, toState, {
      actorUserId: userId,
      note: "note" in body ? (body.note ?? null) : null,
      expiresInDays: body.action === "activate" ? body.expiresInDays : undefined,
      expectedVersion: body.action === "review" ? body.expectedVersion : undefined,
    });

    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: "cad.warrants.review",
      resourceType: "cad_warrant",
      resourceId: id,
      source: "WEB",
      metadata: { action: body.action, toState },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, warrant });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addComment,
  assignReviewer,
  decide,
  getSubmission,
  saveDraft,
  submitSubmission,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_draft"), data: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("submit"), data: z.record(z.string(), z.unknown()).optional() }),
  z.object({
    action: z.literal("decide"),
    decision: z.enum(["APPROVE", "DENY", "REVISE"]),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("comment"),
    body: z.string().min(1).max(4000),
    visibility: z.enum(["APPLICANT", "INTERNAL"]),
  }),
  z.object({ action: z.literal("assign"), membershipId: z.string() }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const { id } = await params;
    return NextResponse.json(await getSubmission({ actor, organizationId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid action");
    const d = parsed.data;
    let result: unknown = { ok: true };
    if (d.action === "save_draft") {
      await saveDraft({ actor, organizationId, submissionId: id, data: d.data });
    } else if (d.action === "submit") {
      result = await submitSubmission({ actor, organizationId, submissionId: id, data: d.data });
    } else if (d.action === "decide") {
      result = await decide({
        actor,
        organizationId,
        submissionId: id,
        decision: d.decision,
        note: d.note,
      });
    } else if (d.action === "comment") {
      await addComment({
        actor,
        organizationId,
        submissionId: id,
        body: d.body,
        visibility: d.visibility,
      });
    } else if (d.action === "assign") {
      await assignReviewer({
        actor,
        organizationId,
        submissionId: id,
        membershipId: d.membershipId,
      });
    }
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

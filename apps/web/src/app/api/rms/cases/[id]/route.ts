import { NextResponse } from "next/server";
import { z } from "zod";
import { addCaseNarrative, getCase, updateCaseStatus } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUSES = [
  "OPEN",
  "ACTIVE",
  "PENDING",
  "AWAITING_EVIDENCE",
  "AWAITING_REVIEW",
  "AWAITING_COURT",
  "CLOSED",
  "ARCHIVED",
] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(await getCase({ actor, organizationId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = z
      .object({
        action: z.enum(["status", "narrative"]),
        status: z.enum(STATUSES).optional(),
        text: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid update");
    if (parsed.data.action === "status") {
      if (!parsed.data.status) throw new ValidationError("Missing status");
      return NextResponse.json({
        case: await updateCaseStatus({ actor, organizationId, id, status: parsed.data.status }),
      });
    }
    if (!parsed.data.text) throw new ValidationError("Missing text");
    await addCaseNarrative({ actor, organizationId, id, text: parsed.data.text });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

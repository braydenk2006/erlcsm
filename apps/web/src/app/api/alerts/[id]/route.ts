import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAlertStatus } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = z
      .object({ status: z.enum(["acknowledged", "dismissed", "resolved", "escalated", "expired"]) })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid status");
    await updateAlertStatus({ actor, organizationId, id, status: parsed.data.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

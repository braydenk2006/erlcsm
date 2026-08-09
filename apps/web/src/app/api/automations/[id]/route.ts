import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAutomation, setAutomationEnabled } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    const { id } = await params;
    const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid update");
    await setAutomationEnabled({ actor, organizationId, id, enabled: parsed.data.enabled });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    const { id } = await params;
    await deleteAutomation({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

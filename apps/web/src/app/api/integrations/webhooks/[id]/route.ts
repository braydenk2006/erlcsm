import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteWebhook, rotateWebhookSecret, setWebhookEnabled, testWebhook } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "webhooks.basic");
    const { id } = await params;
    const parsed = z
      .object({ action: z.enum(["rotate", "enable", "disable", "test"]) })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid action");
    switch (parsed.data.action) {
      case "rotate":
        return NextResponse.json(await rotateWebhookSecret({ actor, organizationId, id }));
      case "enable":
        await setWebhookEnabled({ actor, organizationId, id, enabled: true });
        return NextResponse.json({ ok: true });
      case "disable":
        await setWebhookEnabled({ actor, organizationId, id, enabled: false });
        return NextResponse.json({ ok: true });
      case "test":
        return NextResponse.json({ delivery: await testWebhook({ actor, organizationId, id }) });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "webhooks.basic");
    const { id } = await params;
    await deleteWebhook({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

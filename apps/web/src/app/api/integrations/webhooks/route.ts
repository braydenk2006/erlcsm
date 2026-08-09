import { NextResponse } from "next/server";
import { z } from "zod";
import { createWebhook, listWebhookDeliveries, listWebhooks } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { assertWithinLimit, requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "webhooks.basic");
    const [webhooks, deliveries] = await Promise.all([
      listWebhooks({ actor, organizationId }),
      listWebhookDeliveries({ actor, organizationId }).catch(() => []),
    ]);
    return NextResponse.json({ webhooks, deliveries });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "webhooks.basic");
    await assertWithinLimit(organizationId, "webhooks.max");
    const parsed = z
      .object({
        name: z.string().min(2).max(120),
        url: z.string().url(),
        events: z.array(z.string()).min(1),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid webhook");
    return NextResponse.json(await createWebhook({ actor, organizationId, ...parsed.data }), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

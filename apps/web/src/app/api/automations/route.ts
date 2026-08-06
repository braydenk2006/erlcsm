import { NextResponse } from "next/server";
import { z } from "zod";
import { createAutomation, listAutomations } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  trigger: z.string(),
  description: z.string().max(500).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  actions: z
    .array(z.object({ type: z.string(), config: z.record(z.string(), z.unknown()).default({}) }))
    .min(1),
});

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    const automations = await listAutomations({ actor, organizationId });
    return NextResponse.json({ automations });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid automation");
    const d = parsed.data;
    const automation = await createAutomation({
      actor,
      organizationId,
      name: d.name,
      trigger: d.trigger,
      description: d.description,
      conditions: d.conditions as never,
      actions: d.actions as never,
    });
    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

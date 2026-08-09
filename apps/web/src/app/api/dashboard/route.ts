import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboard, resetDashboardLayout, saveDashboardLayout } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json(await getDashboard({ actor, organizationId }));
  } catch (error) {
    return handleRouteError(error);
  }
}

const layoutSchema = z.object({
  layout: z.array(
    z.object({
      key: z.string(),
      hidden: z.boolean(),
      order: z.number(),
      size: z.enum(["sm", "md", "lg"]),
    }),
  ),
});

export async function PUT(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = layoutSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid layout");
    await saveDashboardLayout({ actor, organizationId, layout: parsed.data.layout });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const { actor, organizationId } = await requireActor();
    await resetDashboardLayout({ actor, organizationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

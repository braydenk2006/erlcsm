import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoal, listGoals } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json({ goals: await listGoals({ actor, organizationId }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  metricKey: z.string(),
  target: z.number(),
  scope: z.enum(["organization", "department", "role"]).optional(),
  departmentId: z.string().optional(),
  dueAt: z.string().optional(),
  recurring: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid goal");
    const d = parsed.data;
    const result = await createGoal({
      actor,
      organizationId,
      name: d.name,
      metricKey: d.metricKey,
      target: d.target,
      scope: d.scope,
      departmentId: d.departmentId,
      dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
      recurring: d.recurring,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

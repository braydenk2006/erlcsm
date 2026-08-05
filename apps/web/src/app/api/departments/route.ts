import { NextResponse } from "next/server";
import { z } from "zod";
import { createDepartment, listDepartments } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    const departments = await listDepartments({ actor, organizationId, includeArchived });
    return NextResponse.json({ departments });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid department");
    const department = await createDepartment({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

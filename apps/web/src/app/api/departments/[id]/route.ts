import { NextResponse } from "next/server";
import { z } from "zod";
import { setDepartmentArchived, updateDepartment } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid department update");
    const { archived, ...rest } = parsed.data;
    if (Object.keys(rest).length > 0) {
      await updateDepartment({ actor, organizationId, departmentId: id, ...rest });
    }
    if (archived !== undefined) {
      await setDepartmentArchived({ actor, organizationId, departmentId: id, archived });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { removeMember, updateMember } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  roleIds: z.array(z.string()).optional(),
  departmentIds: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid member update");
    const member = await updateMember({
      actor,
      organizationId,
      membershipId: id,
      ...parsed.data,
    });
    return NextResponse.json({ member });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    await removeMember({ actor, organizationId, membershipId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

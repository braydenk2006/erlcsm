import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteConversation, getConversation, updateConversation } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(await getConversation({ actor, organizationId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = z
      .object({ pinned: z.boolean().optional(), shared: z.boolean().optional() })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid update");
    await updateConversation({ actor, organizationId, id, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    await deleteConversation({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

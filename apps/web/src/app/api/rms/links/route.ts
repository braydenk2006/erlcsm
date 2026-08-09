import { NextResponse } from "next/server";
import { z } from "zod";
import { link, unlink } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  fromType: z.string(),
  fromId: z.string(),
  toType: z.string(),
  toId: z.string(),
  relation: z.string(),
});

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid link");
    await link({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid link");
    await unlink({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

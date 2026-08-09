import { NextResponse } from "next/server";
import { z } from "zod";
import { getTicket, replyTicket, submitSatisfaction } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(await getTicket({ actor, organizationId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = z
      .object({
        action: z.enum(["reply", "satisfaction"]),
        body: z.string().optional(),
        score: z.number().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid action");
    if (parsed.data.action === "reply") {
      if (!parsed.data.body) throw new ValidationError("Empty reply");
      await replyTicket({ actor, organizationId, id, body: parsed.data.body });
    } else {
      await submitSatisfaction({ actor, organizationId, id, score: parsed.data.score ?? 5 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

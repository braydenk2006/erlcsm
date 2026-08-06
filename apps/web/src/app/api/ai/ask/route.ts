import { NextResponse } from "next/server";
import { z } from "zod";
import { askOrdinex } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(2).max(1000),
  mode: z.string().optional(),
  conversationId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid question");
    const result = await askOrdinex({ actor, organizationId, ...parsed.data });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

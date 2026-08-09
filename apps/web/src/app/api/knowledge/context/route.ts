import { NextResponse } from "next/server";
import { getContextualKnowledge } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Surface relevant published SOPs/policies for a context (e.g. a patrol shift).
export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const keywords = new URL(request.url).searchParams.get("keywords") ?? "";
    return NextResponse.json({
      articles: await getContextualKnowledge({ actor, organizationId, keywords }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

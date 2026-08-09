import { NextResponse } from "next/server";
import { getAiAnalytics, listConversations } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    const [conversations, analytics] = await Promise.all([
      listConversations({ actor, organizationId }),
      getAiAnalytics({ actor, organizationId }),
    ]);
    return NextResponse.json({ conversations, analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}

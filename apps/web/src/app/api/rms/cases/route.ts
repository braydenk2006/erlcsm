import { NextResponse } from "next/server";
import { z } from "zod";
import { createCase, getRmsMetrics, listCases } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const url = new URL(request.url);
    const [cases, metrics] = await Promise.all([
      listCases({
        actor,
        organizationId,
        status: url.searchParams.get("status") ?? undefined,
        query: url.searchParams.get("query") ?? undefined,
      }),
      getRmsMetrics({ actor, organizationId }).catch(() => null),
    ]);
    return NextResponse.json({ cases, metrics });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = z
      .object({
        title: z.string().min(2).max(200),
        narrative: z.string().optional(),
        priority: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid case");
    return NextResponse.json(
      { case: await createCase({ actor, organizationId, ...parsed.data }) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

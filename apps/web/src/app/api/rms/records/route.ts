import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecord, listRecords } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    if (!type) throw new ValidationError("Missing type");
    return NextResponse.json({
      records: await listRecords({
        actor,
        organizationId,
        type,
        status: url.searchParams.get("status") ?? undefined,
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = z
      .object({
        type: z.string(),
        title: z.string().min(2).max(200),
        status: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid record");
    return NextResponse.json(
      { record: await createRecord({ actor, organizationId, ...parsed.data }) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { collectEvidence } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = z
      .object({
        description: z.string().min(2).max(500),
        type: z.string().optional(),
        storageLocation: z.string().optional(),
        location: z.string().optional(),
        caseId: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid evidence");
    return NextResponse.json(
      { evidence: await collectEvidence({ actor, organizationId, ...parsed.data }) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

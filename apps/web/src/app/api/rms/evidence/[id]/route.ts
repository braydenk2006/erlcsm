import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCustody, getCustodyChain } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const ACTIONS = ["TRANSFER", "CHECK_OUT", "RETURN", "RELEASE", "ARCHIVE", "DESTROY"] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(await getCustodyChain({ actor, organizationId, evidenceId: id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = z
      .object({
        action: z.enum(ACTIONS),
        toUserId: z.string().optional(),
        reason: z.string().optional(),
        condition: z.string().optional(),
        signature: z.string().optional(),
        notes: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid custody action");
    return NextResponse.json({
      evidence: await applyCustody({ actor, organizationId, evidenceId: id, ...parsed.data }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

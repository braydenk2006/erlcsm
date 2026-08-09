import { NextResponse } from "next/server";
import { z } from "zod";
import { createTicket, listMyTickets } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json({ tickets: await listMyTickets({ actor, organizationId }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = z
      .object({
        subject: z.string().min(3).max(200),
        category: z.string(),
        priority: z.string().optional(),
        body: z.string().min(3),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid ticket");
    return NextResponse.json(
      { ticket: await createTicket({ actor, organizationId, ...parsed.data }) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

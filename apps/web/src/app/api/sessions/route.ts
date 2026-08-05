import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, listSessions } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(2).max(160),
  type: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "sessions.management");
    const sessions = await listSessions({ actor, organizationId });
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "sessions.management");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid session");
    const session = await createSession({
      actor,
      organizationId,
      title: parsed.data.title,
      type: parsed.data.type,
      notes: parsed.data.notes,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

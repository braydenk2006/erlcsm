import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnnouncement, listAnnouncements } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(2).max(10_000),
  departmentId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const { actor, organizationId, userId } = await requireActor();
    const announcements = await listAnnouncements({ actor, organizationId, userId });
    return NextResponse.json({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid announcement");
    const created = await createAnnouncement({
      actor,
      organizationId,
      title: parsed.data.title,
      body: parsed.data.body,
      departmentId: parsed.data.departmentId ?? null,
      pinned: parsed.data.pinned,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return NextResponse.json({ announcement: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

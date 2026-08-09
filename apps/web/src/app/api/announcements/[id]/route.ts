import { NextResponse } from "next/server";
import { z } from "zod";
import {
  markAnnouncementRead,
  publishAnnouncement,
  setAnnouncementArchived,
  updateAnnouncement,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["update", "publish", "archive", "unarchive", "read"]),
  title: z.string().min(2).max(160).optional(),
  body: z.string().min(2).max(10_000).optional(),
  pinned: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid announcement action");

    // "read" is a per-user action requiring only membership.
    if (parsed.data.action === "read") {
      const { organizationId, userId } = await requireActiveOrganization();
      await markAnnouncementRead({ organizationId, userId, announcementId: id });
      return NextResponse.json({ ok: true });
    }

    const { actor, organizationId } = await requireActor();
    if (parsed.data.action === "update") {
      const expiresAt =
        parsed.data.expiresAt === undefined
          ? undefined
          : parsed.data.expiresAt === null
            ? null
            : new Date(parsed.data.expiresAt);
      await updateAnnouncement({
        actor,
        organizationId,
        announcementId: id,
        title: parsed.data.title,
        body: parsed.data.body,
        pinned: parsed.data.pinned,
        departmentId: parsed.data.departmentId,
        expiresAt,
      });
    } else if (parsed.data.action === "publish") {
      await publishAnnouncement({ actor, organizationId, announcementId: id });
    } else if (parsed.data.action === "archive" || parsed.data.action === "unarchive") {
      await setAnnouncementArchived({
        actor,
        organizationId,
        announcementId: id,
        archived: parsed.data.action === "archive",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

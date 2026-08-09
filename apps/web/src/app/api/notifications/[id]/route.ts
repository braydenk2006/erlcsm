import { NextResponse } from "next/server";
import { markNotificationRead } from "@commandry/api";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Mark a single notification read.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const { id } = await params;
    await markNotificationRead({ organizationId, userId, notificationId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

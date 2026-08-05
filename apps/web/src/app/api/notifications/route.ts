import { NextResponse } from "next/server";
import {
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount,
} from "@commandry/api";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const [notifications, unread] = await Promise.all([
      listNotifications({ organizationId, userId, unreadOnly }),
      unreadNotificationCount({ organizationId, userId }),
    ]);
    return NextResponse.json({ notifications, unread });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Mark all notifications read.
export async function POST() {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const count = await markAllNotificationsRead({ organizationId, userId });
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { staffListTickets } from "@commandry/api";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await requireStaffUser();
    const url = new URL(request.url);
    return NextResponse.json({
      tickets: await staffListTickets({
        staffUserId: userId,
        status: url.searchParams.get("status") ?? undefined,
        assignedToMe: url.searchParams.get("mine") === "1",
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { getStaffOverview } from "@commandry/api";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireStaffUser();
    return NextResponse.json(await getStaffOverview({ staffUserId: userId }));
  } catch (error) {
    return handleRouteError(error);
  }
}

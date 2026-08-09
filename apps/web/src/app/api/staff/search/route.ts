import { NextResponse } from "next/server";
import { searchCustomers } from "@commandry/api";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await requireStaffUser();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ results: await searchCustomers({ staffUserId: userId, query: q }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

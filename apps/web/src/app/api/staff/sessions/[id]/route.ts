import { NextResponse } from "next/server";
import { revokeSupportSession } from "@commandry/api";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireStaffUser();
    const { id } = await params;
    await revokeSupportSession({ staffUserId: userId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

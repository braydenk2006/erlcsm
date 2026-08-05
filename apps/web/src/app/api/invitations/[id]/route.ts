import { NextResponse } from "next/server";
import { resendInvitation, revokeInvitation } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST resends the invitation (issues a fresh token).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const { token } = await resendInvitation({ actor, organizationId, invitationId: id });
    return NextResponse.json({ ok: true, token });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    await revokeInvitation({ actor, organizationId, invitationId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { inviteMember, listInvitations } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    const invitations = await listInvitations({ actor, organizationId });
    return NextResponse.json({ invitations });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const body = await request.json();
    // inviteMember validates input and enforces the members.max plan limit.
    const { invitation, token } = await inviteMember({ actor, organizationId, data: body });
    // Return safe fields only + the raw token (once) so the admin can share the link.
    return NextResponse.json(
      {
        invitation: {
          publicId: invitation.publicId,
          email: invitation.email,
          roleKey: invitation.roleKey,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        token,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

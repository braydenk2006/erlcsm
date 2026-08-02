import { NextResponse } from "next/server";
import { createOrganization, listMembershipsForUser } from "@commandry/api";
import { AppError } from "@commandry/shared";
import { createRequestId, logger } from "@commandry/observability";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const memberships = await listMembershipsForUser(session.user.id);
  return NextResponse.json({
    organizations: memberships.map((membership) => ({
      id: membership.organization.publicId,
      name: membership.organization.name,
      slug: membership.organization.slug,
      roles: membership.roles.map((item) => item.role.key),
    })),
  });
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const log = logger.child({ requestId });
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const organization = await createOrganization({
      userId: session.user.id,
      data: body,
      requestId,
    });

    return NextResponse.json(
      {
        id: organization.publicId,
        name: organization.name,
        slug: organization.slug,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.expose ? error.message : "Request failed", code: error.code },
        { status: error.status },
      );
    }
    log.error("Failed to create organization", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

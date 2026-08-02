import { NextResponse } from "next/server";
import { switchActiveOrganization } from "@commandry/api";
import { AppError } from "@commandry/shared";
import { switchOrganizationSchema } from "@commandry/validation";
import { createRequestId } from "@commandry/observability";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = switchOrganizationSchema.parse(await request.json());
    const organization = await switchActiveOrganization({
      userId: session.user.id,
      organizationId: body.organizationId,
      requestId,
    });

    return NextResponse.json({
      id: organization.publicId,
      name: organization.name,
      slug: organization.slug,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrganizationSupportProfile,
  listSupportSessions,
  startSupportSession,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireStaffUser();
    const { id } = await params;
    const [profile, sessions] = await Promise.all([
      getOrganizationSupportProfile({ staffUserId: userId, organizationId: id }),
      listSupportSessions({ staffUserId: userId, organizationId: id }),
    ]);
    return NextResponse.json({ profile, sessions });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Start a controlled support session for this organization.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireStaffUser();
    const { id } = await params;
    const parsed = z
      .object({
        reason: z.string().min(4),
        scope: z.enum([
          "VIEW_CONFIGURATION",
          "VIEW_AS_CUSTOMER",
          "DIAGNOSE_INTEGRATIONS",
          "DIAGNOSE_ENTITLEMENTS",
          "DIAGNOSE_BILLING",
          "DIAGNOSE_FEATURE",
        ]),
        mode: z.enum(["read_only", "elevated"]).optional(),
        durationMinutes: z.number().optional(),
        ticketId: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid support session");
    return NextResponse.json(
      {
        session: await startSupportSession({
          staffUserId: userId,
          organizationId: id,
          ...parsed.data,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

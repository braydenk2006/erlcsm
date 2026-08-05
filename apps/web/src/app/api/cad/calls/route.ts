import { NextResponse } from "next/server";
import { z } from "zod";
import { createCall, listCalls } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.string().max(40).optional(),
  caller: z.string().max(60).optional(),
  message: z.string().min(1).max(500),
  location: z.string().max(120).optional(),
  postal: z.string().max(20).optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const includeClosed = new URL(request.url).searchParams.get("closed") === "1";
    return NextResponse.json({ calls: await listCalls(organizationId, { includeClosed }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Title and message are required");
    const call = await createCall(organizationId, { ...parsed.data, createdByUserId: userId });
    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

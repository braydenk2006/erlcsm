import { NextResponse } from "next/server";
import { z } from "zod";
import { createCall, listCalls } from "@commandry/cad";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
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
    const { organizationId } = await requireCadPermission("cad.dispatch.view");
    const includeClosed = new URL(request.url).searchParams.get("closed") === "1";
    return NextResponse.json({ calls: await listCalls(organizationId, { includeClosed }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireCadPermission("cad.calls.create");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Title and message are required");
    const call = await createCall(organizationId, { ...parsed.data, createdByUserId: userId });
    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: "cad.calls.create",
      resourceType: "cad_call",
      resourceId: call.id,
      source: "WEB",
      metadata: { title: call.title, priority: call.priority, callNumber: call.callNumber },
    }).catch(() => undefined);
    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

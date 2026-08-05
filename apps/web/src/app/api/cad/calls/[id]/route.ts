import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addCallLog,
  assignUnitToCall,
  closeCall,
  getCall,
  unassignUnitFromCall,
  updateCallStatus,
} from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), unitId: z.string().min(1) }),
  z.object({ action: z.literal("unassign"), unitId: z.string().min(1) }),
  z.object({ action: z.literal("log"), note: z.string().min(1).max(500) }),
  z.object({
    action: z.literal("status"),
    status: z.enum(["PENDING", "DISPATCHED", "ACTIVE", "CLOSED"]),
  }),
  z.object({ action: z.literal("close") }),
]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const { id } = await context.params;
    const call = await getCall(organizationId, id);
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    return NextResponse.json({ call });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, organization } = await requireActiveOrganization();
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid call action");
    const action = parsed.data;

    if (action.action === "assign") await assignUnitToCall(organizationId, id, action.unitId);
    else if (action.action === "unassign")
      await unassignUnitFromCall(organizationId, id, action.unitId);
    else if (action.action === "log")
      await addCallLog(organizationId, id, action.note, organization.name);
    else if (action.action === "status") await updateCallStatus(organizationId, id, action.status);
    else await closeCall(organizationId, id);

    const call = await getCall(organizationId, id);
    return NextResponse.json({ ok: true, call });
  } catch (error) {
    return handleRouteError(error);
  }
}

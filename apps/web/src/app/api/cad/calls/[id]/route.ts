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
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import type { Action } from "@commandry/permissions";
import { requireCadPermission } from "@/lib/cad-auth";
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
    const { organizationId } = await requireCadPermission("cad.dispatch.view");
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
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid call action");
    const action = parsed.data;
    const needed: Action =
      action.action === "assign" || action.action === "unassign"
        ? "cad.calls.assign"
        : action.action === "close" || action.action === "status"
          ? "cad.calls.close"
          : "cad.dispatch.manage";
    const { organizationId, organization } = await requireCadPermission(needed);

    if (action.action === "assign") await assignUnitToCall(organizationId, id, action.unitId);
    else if (action.action === "unassign")
      await unassignUnitFromCall(organizationId, id, action.unitId);
    else if (action.action === "log")
      await addCallLog(organizationId, id, action.note, organization.name);
    else if (action.action === "status") await updateCallStatus(organizationId, id, action.status);
    else await closeCall(organizationId, id);

    if (action.action === "close" || action.action === "status") {
      await recordAuditEvent({
        organizationId,
        action: action.action === "close" ? "cad.calls.close" : "cad.dispatch.manage",
        resourceType: "cad_call",
        resourceId: id,
        source: "WEB",
        metadata: { action: action.action },
      }).catch(() => undefined);
    }

    const call = await getCall(organizationId, id);
    return NextResponse.json({ ok: true, call });
  } catch (error) {
    return handleRouteError(error);
  }
}

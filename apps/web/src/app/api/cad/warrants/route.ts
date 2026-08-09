import { NextResponse } from "next/server";
import { z } from "zod";
import { createWarrant, listWarrants } from "@commandry/cad";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  civilianId: z.string().min(1),
  charges: z.array(z.string().max(120)).max(30).default([]),
  reason: z.string().min(1).max(500),
});

const STATES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DENIED",
  "ACTIVE",
  "SERVED",
  "EXPIRED",
  "RECALLED",
  "DISMISSED",
] as const;

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireCadPermission("cad.dispatch.view");
    const stateParam = new URL(request.url).searchParams.get("state");
    const state = STATES.find((s) => s === stateParam);
    return NextResponse.json({ warrants: await listWarrants(organizationId, state) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, organization } = await requireCadPermission("cad.warrants.create");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A civilian and reason are required");
    const warrant = await createWarrant(organizationId, {
      ...parsed.data,
      issuedByName: organization.name,
    });
    if (!warrant) return NextResponse.json({ error: "Civilian not found" }, { status: 404 });
    await recordAuditEvent({
      organizationId,
      action: "cad.warrants.create",
      resourceType: "cad_warrant",
      resourceId: warrant.id,
      source: "WEB",
      metadata: { reason: warrant.reason, charges: warrant.charges },
    }).catch(() => undefined);
    return NextResponse.json({ warrant }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

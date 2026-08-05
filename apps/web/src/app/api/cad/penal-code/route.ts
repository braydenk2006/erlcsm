import { NextResponse } from "next/server";
import { z } from "zod";
import { createTenantCharge, listTenantPenalCode } from "@commandry/cad";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(120),
  class: z.enum(["Infraction", "Traffic", "Misdemeanor", "Felony"]).optional(),
  fine: z.number().int().min(0).max(1_000_000).optional(),
  jailMinutes: z.number().int().min(0).max(100_000).optional(),
  points: z.number().int().min(0).max(100).optional(),
  isAttempt: z.boolean().optional(),
});

/** Tenant penal code (seeded from the default catalogue on first read). */
export async function GET(request: Request) {
  try {
    const { organizationId } = await requireCadPermission("cad.access");
    const includeArchived = new URL(request.url).searchParams.get("all") === "1";
    return NextResponse.json({
      penalCode: await listTenantPenalCode(organizationId, { includeArchived }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Add or update a tenant penal-code charge. */
export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireCadPermission("cad.configuration.manage");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A code and title are required");
    const charge = await createTenantCharge(organizationId, parsed.data);
    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: "cad.configuration.manage",
      resourceType: "cad_penal_charge",
      resourceId: charge.id,
      source: "WEB",
      metadata: { code: charge.code },
    }).catch(() => undefined);
    return NextResponse.json({ charge }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

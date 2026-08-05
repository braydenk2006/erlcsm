import { NextResponse } from "next/server";
import { z } from "zod";
import { getCadSettings, updateCadSettings } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  version: z.enum(["v1", "v2"]).optional(),
  defaultLanding: z.string().max(40).optional(),
  enabledSections: z.array(z.string().max(40)).max(30).optional(),
  callNumberPrefix: z.string().max(12).nullable().optional(),
});

export async function GET() {
  try {
    const { organizationId } = await requireCadPermission("cad.access");
    return NextResponse.json({ settings: await getCadSettings(organizationId) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId } = await requireCadPermission("cad.configuration.manage");
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid CAD settings");
    const settings = await updateCadSettings(organizationId, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}

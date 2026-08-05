import { NextResponse } from "next/server";
import { z } from "zod";
import { createVehicle, listVehicles } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  plate: z.string().min(1).max(12),
  model: z.string().min(1).max(60),
  color: z.string().max(30).optional(),
  ownerCivilianId: z.string().max(60).optional(),
  registration: z.enum(["VALID", "EXPIRED", "SUSPENDED", "NONE"]).optional(),
  insurance: z.enum(["VALID", "EXPIRED", "SUSPENDED", "NONE"]).optional(),
  stolen: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const search = new URL(request.url).searchParams.get("q") ?? undefined;
    return NextResponse.json({ vehicles: await listVehicles(organizationId, search) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Plate and model are required");
    const vehicle = await createVehicle(organizationId, parsed.data);
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

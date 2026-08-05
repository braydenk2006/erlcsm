import { NextResponse } from "next/server";
import { z } from "zod";
import { createBolo, listBolos } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  type: z.enum(["PERSON", "VEHICLE"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  plate: z.string().max(12).optional(),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const statusParam = new URL(request.url).searchParams.get("status");
    const status = statusParam === "ACTIVE" || statusParam === "CLEARED" ? statusParam : undefined;
    return NextResponse.json({ bolos: await listBolos(organizationId, status) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, organization } = await requireActiveOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Type, title, and description are required");
    const bolo = await createBolo(organizationId, {
      ...parsed.data,
      createdByName: organization.name,
    });
    return NextResponse.json({ bolo }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

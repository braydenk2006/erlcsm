import { NextResponse } from "next/server";
import { z } from "zod";
import { createWarrant, listWarrants } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  civilianId: z.string().min(1),
  charges: z.array(z.string().max(120)).max(30).default([]),
  reason: z.string().min(1).max(500),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const statusParam = new URL(request.url).searchParams.get("status");
    const status =
      statusParam === "ACTIVE" || statusParam === "CLEARED" || statusParam === "EXPIRED"
        ? statusParam
        : undefined;
    return NextResponse.json({ warrants: await listWarrants(organizationId, status) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, organization } = await requireActiveOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A civilian and reason are required");
    const warrant = await createWarrant(organizationId, {
      ...parsed.data,
      issuedByName: organization.name,
    });
    if (!warrant) return NextResponse.json({ error: "Civilian not found" }, { status: 404 });
    return NextResponse.json({ warrant }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createCivilian, listCivilians } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  dateOfBirth: z.string().max(40).optional(),
  gender: z.string().max(30).optional(),
  address: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  licenseStatus: z.enum(["VALID", "SUSPENDED", "REVOKED", "EXPIRED", "NONE"]).optional(),
  robloxUsername: z.string().max(60).optional(),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const search = new URL(request.url).searchParams.get("q") ?? undefined;
    return NextResponse.json({ civilians: await listCivilians(organizationId, search) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("First and last name are required");
    const civilian = await createCivilian(organizationId, {
      ...parsed.data,
      createdByUserId: userId,
    });
    return NextResponse.json({ civilian }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

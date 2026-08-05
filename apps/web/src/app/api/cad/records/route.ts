import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecord, listRecords } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  civilianId: z.string().optional(),
  type: z.enum(["CITATION", "ARREST", "INCIDENT", "WARNING"]),
  title: z.string().min(1).max(120),
  charges: z.array(z.string().max(120)).max(30).default([]),
  fineAmount: z.number().int().min(0).max(1_000_000).optional(),
  narrative: z.string().max(4000).optional(),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireCadPermission("cad.people.view");
    const typeParam = new URL(request.url).searchParams.get("type");
    const type =
      typeParam === "CITATION" ||
      typeParam === "ARREST" ||
      typeParam === "INCIDENT" ||
      typeParam === "WARNING"
        ? typeParam
        : undefined;
    return NextResponse.json({ records: await listRecords(organizationId, { type }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, organization } = await requireCadPermission("cad.records.create");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A record type and title are required");
    const record = await createRecord(organizationId, {
      ...parsed.data,
      officerName: organization.name,
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

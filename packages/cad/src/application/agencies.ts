import { prisma } from "@commandry/database";
import { createPublicId } from "@commandry/shared";
import type { CadUnitType } from "../service";

export type AgencyView = {
  id: string;
  name: string;
  shortName: string | null;
  type: CadUnitType;
  departmentId: string | null;
  unitCount: number;
};

export async function listAgencies(organizationId: string): Promise<AgencyView[]> {
  const agencies = await prisma.cadAgency.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { units: true } } },
  });
  return agencies.map((agency) => ({
    id: agency.publicId,
    name: agency.name,
    shortName: agency.shortName,
    type: agency.type as CadUnitType,
    departmentId: agency.departmentId,
    unitCount: agency._count.units,
  }));
}

export async function createAgency(
  organizationId: string,
  input: { name: string; shortName?: string; type?: CadUnitType; departmentId?: string | null },
): Promise<AgencyView> {
  const agency = await prisma.cadAgency.create({
    data: {
      publicId: createPublicId("agc"),
      organizationId,
      name: input.name,
      shortName: input.shortName ?? null,
      type: input.type ?? "POLICE",
      departmentId: input.departmentId ?? null,
    },
  });
  return {
    id: agency.publicId,
    name: agency.name,
    shortName: agency.shortName,
    type: agency.type as CadUnitType,
    departmentId: agency.departmentId,
    unitCount: 0,
  };
}

/** Ensure an org has at least one agency (used when onboarding CAD v2). */
export async function ensureDefaultAgency(organizationId: string): Promise<AgencyView> {
  const existing = await listAgencies(organizationId);
  if (existing[0]) return existing[0];
  return createAgency(organizationId, { name: "Default Agency", shortName: "AGY" });
}

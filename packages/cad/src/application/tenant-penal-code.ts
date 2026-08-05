import { prisma } from "@commandry/database";
import { createPublicId } from "@commandry/shared";
import { PENAL_CODE } from "../penal-code";

export type PenalChargeView = {
  id: string;
  code: string;
  title: string;
  class: string;
  fine: number;
  jailMinutes: number;
  points: number;
  isAttempt: boolean;
  active: boolean;
};

function toView(row: {
  publicId: string;
  code: string;
  title: string;
  class: string;
  fine: number;
  jailMinutes: number;
  points: number;
  isAttempt: boolean;
  active: boolean;
}): PenalChargeView {
  return {
    id: row.publicId,
    code: row.code,
    title: row.title,
    class: row.class,
    fine: row.fine,
    jailMinutes: row.jailMinutes,
    points: row.points,
    isAttempt: row.isAttempt,
    active: row.active,
  };
}

/** Seed the org's penal code from the default catalogue if it is empty. */
export async function ensureTenantPenalCode(organizationId: string): Promise<void> {
  const count = await prisma.cadPenalCharge.count({ where: { organizationId } });
  if (count > 0) return;
  await prisma.cadPenalCharge.createMany({
    data: PENAL_CODE.map((charge) => ({
      publicId: createPublicId("pcode"),
      organizationId,
      code: charge.code,
      title: charge.title,
      class: charge.class,
      fine: charge.fine,
      jailMinutes: charge.jailMinutes,
    })),
    skipDuplicates: true,
  });
}

export async function listTenantPenalCode(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<PenalChargeView[]> {
  await ensureTenantPenalCode(organizationId);
  const rows = await prisma.cadPenalCharge.findMany({
    where: { organizationId, ...(options.includeArchived ? {} : { active: true }) },
    orderBy: { code: "asc" },
  });
  return rows.map(toView);
}

export async function createTenantCharge(
  organizationId: string,
  input: {
    code: string;
    title: string;
    class?: string;
    fine?: number;
    jailMinutes?: number;
    points?: number;
    isAttempt?: boolean;
  },
): Promise<PenalChargeView> {
  const row = await prisma.cadPenalCharge.upsert({
    where: { organizationId_code: { organizationId, code: input.code } },
    create: {
      publicId: createPublicId("pcode"),
      organizationId,
      code: input.code,
      title: input.title,
      class: input.class ?? "Misdemeanor",
      fine: input.fine ?? 0,
      jailMinutes: input.jailMinutes ?? 0,
      points: input.points ?? 0,
      isAttempt: input.isAttempt ?? false,
    },
    update: {
      title: input.title,
      class: input.class ?? "Misdemeanor",
      fine: input.fine ?? 0,
      jailMinutes: input.jailMinutes ?? 0,
      points: input.points ?? 0,
      isAttempt: input.isAttempt ?? false,
      active: true,
      archivedAt: null,
    },
  });
  return toView(row);
}

export async function archiveTenantCharge(
  organizationId: string,
  chargePublicId: string,
  archived: boolean,
): Promise<void> {
  await prisma.cadPenalCharge.updateMany({
    where: { organizationId, publicId: chargePublicId },
    data: { active: !archived, archivedAt: archived ? new Date() : null },
  });
}

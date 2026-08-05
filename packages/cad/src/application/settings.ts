import { prisma } from "@commandry/database";
import { formatCallNumber } from "../domain";

export type CadVersion = "v1" | "v2";

export type CadSettingsView = {
  enabled: boolean;
  version: CadVersion;
  defaultLanding: string;
  enabledSections: string[];
  callNumberPrefix: string | null;
};

const DEFAULT_SECTIONS = [
  "command",
  "dispatch",
  "mdt",
  "units",
  "calls",
  "persons",
  "vehicles",
  "records",
  "warrants",
  "bolos",
];

/** Read CAD settings for an org, returning safe defaults when unset. */
export async function getCadSettings(organizationId: string): Promise<CadSettingsView> {
  const row = await prisma.cadSettings.findUnique({ where: { organizationId } });
  if (!row) {
    return {
      enabled: true,
      version: "v1",
      defaultLanding: "command",
      enabledSections: DEFAULT_SECTIONS,
      callNumberPrefix: null,
    };
  }
  return {
    enabled: row.enabled,
    version: row.version === "v2" ? "v2" : "v1",
    defaultLanding: row.defaultLanding,
    enabledSections: row.enabledSections,
    callNumberPrefix: row.callNumberPrefix,
  };
}

export async function updateCadSettings(
  organizationId: string,
  patch: {
    enabled?: boolean;
    version?: CadVersion;
    defaultLanding?: string;
    enabledSections?: string[];
    callNumberPrefix?: string | null;
  },
): Promise<CadSettingsView> {
  await prisma.cadSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabled: patch.enabled ?? true,
      version: patch.version ?? "v1",
      defaultLanding: patch.defaultLanding ?? "command",
      enabledSections: patch.enabledSections ?? DEFAULT_SECTIONS,
      callNumberPrefix: patch.callNumberPrefix ?? null,
    },
    update: {
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.version ? { version: patch.version } : {}),
      ...(patch.defaultLanding ? { defaultLanding: patch.defaultLanding } : {}),
      ...(patch.enabledSections ? { enabledSections: patch.enabledSections } : {}),
      ...(patch.callNumberPrefix !== undefined ? { callNumberPrefix: patch.callNumberPrefix } : {}),
    },
  });
  return getCadSettings(organizationId);
}

/**
 * Allocate the next monotonic call number for an org (atomic increment).
 * Returns both the sequence and the formatted, human-readable number.
 */
export async function allocateCallNumber(
  organizationId: string,
): Promise<{ sequence: number; callNumber: string }> {
  const settings = await prisma.cadSettings.upsert({
    where: { organizationId },
    create: { organizationId, callSequence: 1 },
    update: { callSequence: { increment: 1 } },
  });
  const format = settings.callNumberPrefix ? { prefix: settings.callNumberPrefix } : {};
  return {
    sequence: settings.callSequence,
    callNumber: formatCallNumber(settings.callSequence, format),
  };
}

/** Allocate the next warrant number (atomic increment). */
export async function allocateWarrantNumber(organizationId: string): Promise<string> {
  const settings = await prisma.cadSettings.upsert({
    where: { organizationId },
    create: { organizationId, warrantSequence: 1 },
    update: { warrantSequence: { increment: 1 } },
  });
  return formatCallNumber(settings.warrantSequence, { prefix: "W" });
}

/** Allocate the next record number (atomic increment). */
export async function allocateRecordNumber(organizationId: string): Promise<string> {
  const settings = await prisma.cadSettings.upsert({
    where: { organizationId },
    create: { organizationId, recordSequence: 1 },
    update: { recordSequence: { increment: 1 } },
  });
  return formatCallNumber(settings.recordSequence, { prefix: "R" });
}

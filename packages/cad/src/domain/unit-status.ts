export const CAD_UNIT_STATUSES = [
  "AVAILABLE",
  "BUSY",
  "EN_ROUTE",
  "ON_SCENE",
  "PANIC",
  "OUT_OF_SERVICE",
] as const;

export type CadUnitStatus = (typeof CAD_UNIT_STATUSES)[number];

// Statuses that mean the unit is actively engaged and should not be
// auto-recommended for new calls.
const ENGAGED: ReadonlySet<CadUnitStatus> = new Set(["EN_ROUTE", "ON_SCENE", "BUSY", "PANIC"]);

export function isEngagedStatus(status: CadUnitStatus): boolean {
  return ENGAGED.has(status);
}

export function isAvailableForDispatch(status: CadUnitStatus): boolean {
  return status === "AVAILABLE";
}

/**
 * Unit status transition rules. PANIC can be entered from anywhere (officer
 * safety). A unit that is OUT_OF_SERVICE must return to AVAILABLE before taking
 * other statuses. All other transitions between active statuses are permitted.
 */
export function canTransitionUnit(from: CadUnitStatus, to: CadUnitStatus): boolean {
  if (from === to) return true;
  if (to === "PANIC") return true;
  if (from === "OUT_OF_SERVICE") return to === "AVAILABLE";
  return true;
}

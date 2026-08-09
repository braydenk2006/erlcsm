export type CallNumberFormat = {
  /** Optional prefix, e.g. "PD" -> "PD-2026-000001". */
  prefix?: string;
  /** Include the year segment (default true). */
  includeYear?: boolean;
  /** Zero-pad width for the sequence (default 6). */
  pad?: number;
};

/**
 * Format a configurable, human-readable CAD call number from a monotonic
 * sequence. Pure and deterministic so it can be tested and reproduced.
 * Examples: 2026-000001, PD-2026-000042.
 */
export function formatCallNumber(
  sequence: number,
  format: CallNumberFormat = {},
  now = new Date(),
): string {
  const pad = format.pad ?? 6;
  const seq = String(Math.max(0, Math.floor(sequence))).padStart(pad, "0");
  const parts: string[] = [];
  if (format.prefix) parts.push(format.prefix);
  if (format.includeYear !== false) parts.push(String(now.getUTCFullYear()));
  parts.push(seq);
  return parts.join("-");
}

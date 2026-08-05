/** Whether a dated item (warrant/BOLO) has passed its expiration. */
export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/** Milliseconds until expiration; null when there is no expiry, negative when past. */
export function timeUntilExpiry(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null;
  return expiresAt.getTime() - now.getTime();
}

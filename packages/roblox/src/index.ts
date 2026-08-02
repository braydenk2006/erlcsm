export type RobloxIdentityDraft = {
  robloxUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

/**
 * Roblox verification uses official/permitted methods only.
 * Cookie scraping and prohibited automation are intentionally unsupported.
 */
export function assertStableRobloxUserId(userId: string): string {
  if (!/^\d+$/.test(userId)) {
    throw new Error("Roblox user IDs must be numeric strings");
  }
  return userId;
}

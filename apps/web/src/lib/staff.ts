import { redirect } from "next/navigation";
import { getPlatformRole, type PlatformRole } from "@commandry/api";
import { ForbiddenError } from "@commandry/shared";
import { getSession, requireSession } from "@/lib/session";

const TIER: Record<PlatformRole, number> = { NONE: 0, SUPPORT: 1, ADMIN: 2, SUPERADMIN: 3 };

/** Server-verified platform-staff gate for API routes (throws → 403). */
export async function requireStaffUser(
  min: PlatformRole = "SUPPORT",
): Promise<{ userId: string; role: PlatformRole }> {
  const session = await requireSession();
  const role = await getPlatformRole(session.user.id);
  if (TIER[role] < TIER[min]) throw new ForbiddenError("Ordinex staff access required");
  return { userId: session.user.id, role };
}

/** Server-verified platform-staff gate for pages (redirects non-staff to /app). */
export async function requireStaffPage(
  min: PlatformRole = "SUPPORT",
): Promise<{ userId: string; role: PlatformRole }> {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const role = await getPlatformRole(session.user.id);
  if (TIER[role] < TIER[min]) redirect("/app");
  return { userId: session.user.id, role };
}

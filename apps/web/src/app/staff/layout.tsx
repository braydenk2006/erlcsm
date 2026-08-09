import Link from "next/link";
import { requireStaffPage } from "@/lib/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordinex Staff" };

// Internal Ordinex Staff Panel — completely separate from customer org access.
// Access is server-verified from user.platformRole; org owners get nothing here.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireStaffPage();
  return (
    <div className="min-h-screen bg-[var(--cmd-bg)]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--cmd-danger)]/40 bg-[rgba(30,8,12,0.7)] px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <span className="rounded-[var(--cmd-radius-pill)] bg-[var(--cmd-danger)]/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cmd-danger)]">
            Ordinex Staff
          </span>
          <span className="text-xs text-[var(--cmd-fg-muted)]">
            platform role: {role.toLowerCase()}
          </span>
        </div>
        <Link href="/app" className="text-sm text-[var(--cmd-fg-muted)] hover:text-[var(--cmd-fg)]">
          ← Back to workspace
        </Link>
      </header>
      <main className="px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

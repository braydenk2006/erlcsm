import Link from "next/link";
import type { PublicSite } from "@commandry/api";

export function PublicShell({ site, children }: { site: PublicSite; children: React.ReactNode }) {
  const b = site.branding;
  const href = (slug: string) =>
    slug === "home"
      ? `/c/${site.orgSlug}`
      : slug.startsWith("http")
        ? slug
        : `/c/${site.orgSlug}/${slug}`;
  return (
    <div
      style={site.themeVars as React.CSSProperties}
      className="min-h-screen bg-[var(--site-bg)] font-[family-name:var(--site-font-body)] text-[var(--site-fg)]"
    >
      <header className="border-b border-[var(--site-border)] bg-[var(--site-surface)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href={`/c/${site.orgSlug}`} className="flex items-center gap-2">
            {b.logoUrl ? (
              <img src={b.logoUrl} alt="" className="h-8 w-8 rounded" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--site-primary)] font-bold text-white">
                {b.name.slice(0, 1)}
              </span>
            )}
            <span className="font-[family-name:var(--site-font-heading)] text-lg font-semibold">
              {b.name}
            </span>
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {site.nav.map((n) => (
              <Link
                key={n.slug}
                href={href(n.slug)}
                className="text-[var(--site-muted)] hover:text-[var(--site-fg)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>

      <footer className="border-t border-[var(--site-border)] bg-[var(--site-surface)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-[var(--site-muted)]">
          <div>
            <p className="font-medium text-[var(--site-fg)]">{b.name}</p>
            {b.description ? <p>{b.description}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {b.discordInvite ? (
              <a href={b.discordInvite} className="hover:text-[var(--site-fg)]">
                Discord
              </a>
            ) : null}
            {b.robloxGroup ? (
              <a href={b.robloxGroup} className="hover:text-[var(--site-fg)]">
                Roblox
              </a>
            ) : null}
            {b.socials.map((s) => (
              <a key={s.url} href={s.url} className="hover:text-[var(--site-fg)]">
                {s.label}
              </a>
            ))}
            <span>Powered by Ordinex</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

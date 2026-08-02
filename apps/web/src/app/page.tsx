import Link from "next/link";
import { Button } from "@commandry/ui";

export default function LandingPage() {
  return (
    <main id="main" className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <p className="font-[family-name:var(--cmd-font-display)] text-2xl tracking-tight">
            Commandry
          </p>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-in">Launch workspace</Link>
            </Button>
          </div>
        </header>

        <section className="relative mt-16 flex flex-1 flex-col justify-center gap-8 pb-20 md:mt-0">
          <div className="absolute inset-x-0 top-10 -z-10 h-[420px] rounded-[28px] bg-[linear-gradient(135deg,rgba(15,118,110,0.35),rgba(14,165,233,0.18),transparent)] blur-0" />
          <p className="animate-rise font-[family-name:var(--cmd-font-display)] text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Commandry
          </p>
          <h1 className="animate-rise-delay max-w-3xl text-2xl font-medium text-[var(--cmd-fg-muted)] md:text-3xl">
            Connect the community once, then operate everything from one fast, secure, intelligent
            platform.
          </h1>
          <p className="max-w-2xl text-base text-[var(--cmd-fg-muted)] md:text-lg">
            Staff, sessions, moderation, CAD, training, Discord, and ER:LC live operations — unified
            under tenant-isolated controls built for serious communities.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs/status">Architecture status</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

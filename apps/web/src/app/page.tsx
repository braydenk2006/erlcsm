import Link from "next/link";
import { Button } from "@commandry/ui";
import { BrandMark } from "@/components/brand-mark";

export default function LandingPage() {
  return (
    <main id="main" className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(59,108,255,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 70% 60%, rgba(168,85,247,0.18), transparent 55%)",
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="cmd-glass flex items-center justify-between gap-4 rounded-[var(--cmd-radius-xl)] px-4 py-3 md:px-5">
          <div className="flex items-center gap-3">
            <BrandMark size={42} priority className="cmd-crest-glow" />
            <p className="font-[family-name:var(--cmd-font-display)] text-xl font-semibold tracking-[0.08em] uppercase">
              Commandry
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-in">Launch workspace</Link>
            </Button>
          </div>
        </header>

        <section className="relative mt-10 flex flex-1 flex-col items-center justify-center gap-7 pb-16 text-center md:mt-0">
          <div className="animate-rise relative">
            <div
              aria-hidden="true"
              className="animate-crest absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(circle,rgba(59,108,255,0.35),rgba(168,85,247,0.12)_45%,transparent_70%)] blur-2xl"
            />
            <BrandMark
              size={180}
              priority
              className="cmd-crest-glow mx-auto h-auto w-[min(52vw,180px)]"
            />
          </div>

          <p className="animate-rise font-[family-name:var(--cmd-font-display)] text-5xl font-semibold tracking-[0.12em] uppercase md:text-7xl">
            <span className="cmd-gradient-text">Commandry</span>
          </p>

          <h1 className="animate-rise-delay max-w-2xl text-lg font-medium text-[var(--cmd-fg-muted)] md:text-2xl">
            Connect the community once, then operate everything from one fast, secure, intelligent
            platform.
          </h1>

          <div className="animate-rise-delay flex flex-wrap items-center justify-center gap-3">
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

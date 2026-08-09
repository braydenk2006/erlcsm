import Link from "next/link";
import { Button } from "@commandry/ui";
import { BrandMark } from "@/components/brand-mark";

export default function LandingPage() {
  return (
    <main id="main" className="relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-aurora absolute -left-24 top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,59,92,0.35),transparent_70%)] blur-3xl" />
        <div className="animate-aurora absolute -right-16 top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.35),transparent_70%)] blur-3xl [animation-delay:1.2s]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(45,226,197,0.2),transparent_70%)] blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8 md:py-8">
        <header className="cmd-glass-strong flex items-center justify-between gap-4 rounded-[var(--cmd-radius-pill)] px-3 py-2.5 pl-3 pr-3 md:px-4">
          <div className="flex items-center gap-3">
            <BrandMark size={40} priority className="cmd-crest-glow" />
            <p className="font-[family-name:var(--cmd-font-display)] text-lg font-semibold tracking-[0.06em] md:text-xl">
              Ordinex
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/plans">Plans</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-in">Launch</Link>
            </Button>
          </div>
        </header>

        <section className="relative mt-8 flex flex-1 flex-col items-center justify-center gap-7 pb-16 text-center md:mt-0">
          <div className="animate-float relative">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(circle,rgba(255,59,92,0.28),rgba(124,92,255,0.16)_45%,transparent_70%)] blur-2xl"
            />
            <BrandMark
              size={188}
              priority
              className="cmd-crest-glow mx-auto h-auto w-[min(54vw,188px)]"
            />
          </div>

          <p className="animate-rise font-[family-name:var(--cmd-font-display)] text-5xl font-semibold tracking-[-0.03em] md:text-7xl">
            <span className="cmd-gradient-text">Ordinex</span>
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
              <Link href="/docs/status">See status</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

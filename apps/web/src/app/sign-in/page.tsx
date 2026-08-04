import { SignInForm } from "@/components/sign-in-form";
import { BrandMark } from "@/components/brand-mark";

export default function SignInPage() {
  return (
    <main
      id="main"
      className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-16 -z-10 mx-auto h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,59,92,0.28),transparent_70%)] blur-3xl"
      />
      <div className="cmd-glass-strong rounded-[var(--cmd-radius-xl)] p-8 md:p-10">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={76} priority className="cmd-crest-glow" />
          <p className="mt-4 font-[family-name:var(--cmd-font-display)] text-3xl font-semibold tracking-[-0.02em]">
            Commandry
          </p>
          <h1 className="mt-2 text-base text-[var(--cmd-fg-muted)]">Sign in to your workspace</h1>
        </div>
        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
